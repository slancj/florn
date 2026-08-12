import { BareMuxConnection } from "/baremux/index.mjs";

let scramjet = null;
let scramjetFrame = null;
let loaderTimeout = null;

const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const searchSection = document.getElementById('searchSection');
const browserContainer = document.getElementById('browserContainer');
const searchForm = document.getElementById('searchForm');
const urlInput = document.getElementById('urlInput');
const browserAddressInput = document.getElementById('browserAddressInput');
const proxyIframe = document.getElementById('proxyIframe');
const iframeLoader = document.getElementById('iframeLoader');

// Toolbar buttons
const btnHome = document.getElementById('btnHome');
const btnBack = document.getElementById('btnBack');
const btnForward = document.getElementById('btnForward');
const btnReload = document.getElementById('btnReload');
const btnFullscreen = document.getElementById('btnFullscreen');

// Loader control helpers
function showLoader() {
  iframeLoader.classList.remove('hidden');
  if (loaderTimeout) clearTimeout(loaderTimeout);
  loaderTimeout = setTimeout(() => {
    iframeLoader.classList.add('hidden');
  }, 10000); // Auto-hide after 10s max
}

function hideLoader() {
  if (loaderTimeout) clearTimeout(loaderTimeout);
  iframeLoader.classList.add('hidden');
}

// Initialize Proxy Engine
async function initProxy() {
  try {
    statusText.textContent = 'Registering SW...';

    // 1. Register Service Worker & ensure page is controlled
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // If SW is registered but not controlling this window yet, wait for claim or reload
      if (!navigator.serviceWorker.controller) {
        statusText.textContent = 'Activating worker...';
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          setTimeout(() => location.reload(), 500);
        });
      }
    }

    statusText.textContent = 'Setting transport...';

    // 2. Connect BareMux to Wisp backend via Epoxy
    const connection = new BareMuxConnection("/baremux/worker.js");
    const wispProtocol = location.protocol === "https:" ? "wss://" : "ws://";
    const wispUrl = `${wispProtocol}${location.host}/wisp/`;

    await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);

    statusText.textContent = 'Loading engine...';

    // 3. Initialize Scramjet Controller
    const { ScramjetController } = $scramjetLoadController();
    scramjet = new ScramjetController({
      prefix: "/scramjet/",
      files: {
        wasm: "/scramjet/scramjet.wasm.wasm",
        all: "/scramjet/scramjet.all.js",
        sync: "/scramjet/scramjet.sync.js",
      },
      flags: {
        serviceworkers: true,
      },
    });

    try {
      await scramjet.init();
    } catch (idbErr) {
      console.warn('Scramjet IDB init failed, resetting IndexedDB database and retrying...', idbErr);
      if ('indexedDB' in window) {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase('$scramjet');
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      }
      await scramjet.init();
    }

    // 4. Create proxy browser frame
    scramjetFrame = scramjet.createFrame(proxyIframe);

    statusBadge.classList.add('ready');
    statusText.textContent = 'Proxy Ready';
  } catch (err) {
    console.error('Failed to initialize Scramjet:', err);
    statusText.textContent = 'Init Error';
  }
}

// Format query into valid URL
function formatUrl(query) {
  query = query.trim();
  if (!query) return 'https://duckduckgo.com';

  if (/^https?:\/\//i.test(query)) {
    return query;
  }

  if (query.includes('.') && !query.includes(' ')) {
    return 'https://' + query;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

// Navigate proxy to URL
function launchUrl(url) {
  if (!scramjetFrame) {
    alert('Proxy engine is still initializing. Please wait a moment...');
    return;
  }

  const finalUrl = formatUrl(url);
  browserAddressInput.value = finalUrl;

  searchSection.classList.add('hidden');
  browserContainer.classList.remove('hidden');
  showLoader();

  scramjetFrame.go(finalUrl);
}

// Hide loader when iframe finishes loading and sync URL bar
proxyIframe.addEventListener('load', () => {
  hideLoader();
  try {
    const rawHref = proxyIframe.contentWindow?.location?.href;
    if (rawHref && rawHref !== 'about:blank' && document.activeElement !== browserAddressInput) {
      if (rawHref.includes('/scramjet/')) {
        const encoded = rawHref.split('/scramjet/')[1];
        if (encoded) {
          try {
            browserAddressInput.value = decodeURIComponent(encoded);
          } catch (e) {
            browserAddressInput.value = encoded;
          }
        }
      }
    }
  } catch (e) {
    // Cross-origin restriction on frame contentWindow access
  }
});

// Event Listeners for Homepage Form
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  launchUrl(urlInput.value);
});

// Editable Address Bar Enter Key Navigation
browserAddressInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (browserAddressInput.value.trim()) {
      launchUrl(browserAddressInput.value);
    }
  }
});

browserAddressInput.addEventListener('focus', () => {
  browserAddressInput.select();
});

// Quick launch cards
document.querySelectorAll('.shortcut-card').forEach(card => {
  card.addEventListener('click', () => {
    const targetUrl = card.getAttribute('data-url');
    urlInput.value = targetUrl;
    launchUrl(targetUrl);
  });
});

// Toolbar Controls
btnHome.addEventListener('click', () => {
  browserContainer.classList.add('hidden');
  searchSection.classList.remove('hidden');
  proxyIframe.src = 'about:blank';
});

btnBack.addEventListener('click', () => {
  try {
    if (scramjetFrame && typeof scramjetFrame.back === 'function') {
      scramjetFrame.back();
    } else if (proxyIframe.contentWindow) {
      proxyIframe.contentWindow.history.back();
    }
  } catch (err) {
    console.warn('Back navigation error:', err);
  }
});

btnForward.addEventListener('click', () => {
  try {
    if (scramjetFrame && typeof scramjetFrame.forward === 'function') {
      scramjetFrame.forward();
    } else if (proxyIframe.contentWindow) {
      proxyIframe.contentWindow.history.forward();
    }
  } catch (err) {
    console.warn('Forward navigation error:', err);
  }
});

btnReload.addEventListener('click', () => {
  showLoader();
  try {
    if (scramjetFrame && typeof scramjetFrame.reload === 'function') {
      scramjetFrame.reload();
    } else if (proxyIframe.contentWindow) {
      proxyIframe.contentWindow.location.reload();
    } else if (browserAddressInput.value) {
      launchUrl(browserAddressInput.value);
    }
  } catch (err) {
    console.warn('Reload fallback triggered:', err);
    if (browserAddressInput.value) {
      launchUrl(browserAddressInput.value);
    }
  }
});

btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    browserContainer.requestFullscreen().catch(err => {
      console.error('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen();
  }
});

window.addEventListener('DOMContentLoaded', initProxy);
