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

// Ensure clean IndexedDB database schema for Scramjet
async function ensureValidScramjetIDB() {
  if (!('indexedDB' in window)) return;
  return new Promise((resolve) => {
    const checkReq = indexedDB.open('$scramjet');
    checkReq.onsuccess = () => {
      const db = checkReq.result;
      if (db && !db.objectStoreNames.contains('config')) {
        db.close();
        console.warn('Scramjet IndexedDB missing config store, resetting database...');
        const delReq = indexedDB.deleteDatabase('$scramjet');
        delReq.onsuccess = resolve;
        delReq.onerror = resolve;
        delReq.onblocked = resolve;
      } else {
        db.close();
        resolve();
      }
    };
    checkReq.onerror = () => resolve();
  });
}

// Initialize Proxy Engine
async function initProxy() {
  try {
    statusText.textContent = 'Registering SW...';

    // 1. Register Service Worker & ensure page is controlled
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // If SW is registered but not controlling this windoLoading engine...w yet, wait for claim or reload
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

    // 3. Ensure valid IndexedDB schema
    await ensureValidScramjetIDB();

    // 4. Initialize Scramjet Controller
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
      console.warn('Scramjet IDB init failed, deleting $scramjet DB and retrying...', idbErr);
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('$scramjet');
        req.onsuccess = resolve;
        req.onerror = resolve;
        req.onblocked = resolve;
      });
      await scramjet.init();
    }

    // 5. Create proxy browser frame
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
  if (/^https?:\/\//i.test(query)) return query;
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(query)) {
    return 'https://' + query;
  }
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
}

// Launch URL in Proxy Frame
function launchUrl(rawUrl) {
  const targetUrl = formatUrl(rawUrl);
  searchSection.classList.add('hidden');
  browserContainer.classList.remove('hidden');
  browserAddressInput.value = targetUrl;
  showLoader();

  if (scramjetFrame) {
    scramjetFrame.go(targetUrl);
  } else {
    proxyIframe.src = '/scramjet/' + encodeURIComponent(targetUrl);
  }
}

// Reset UI back to Search Launcher
function goHome() {
  browserContainer.classList.add('hidden');
  searchSection.classList.remove('hidden');
  proxyIframe.src = 'about:blank';
  urlInput.value = '';
  browserAddressInput.value = '';
  hideLoader();
}

// Event Listeners setup
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = urlInput.value;
  if (query) launchUrl(query);
});

// Interactive Address Bar inside Iframe View
browserAddressInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const newUrl = browserAddressInput.value;
    if (newUrl) launchUrl(newUrl);
  }
});

// Hide loader when iframe finishes loading
proxyIframe.addEventListener('load', () => {
  hideLoader();
  try {
    if (scramjetFrame && scramjetFrame.url) {
      browserAddressInput.value = scramjetFrame.url.href;
    }
  } catch (e) { }
});

// Quick launch buttons
document.querySelectorAll('.shortcut-card').forEach((card) => {
  card.addEventListener('click', () => {
    const target = card.getAttribute('data-url');
    if (target) launchUrl(target);
  });
});

// Toolbar Actions
btnHome.addEventListener('click', goHome);

btnBack.addEventListener('click', () => {
  if (scramjetFrame) scramjetFrame.back();
  else proxyIframe.contentWindow?.history.back();
  showLoader();
});

btnForward.addEventListener('click', () => {
  if (scramjetFrame) scramjetFrame.forward();
  else proxyIframe.contentWindow?.history.forward();
  showLoader();
});

btnReload.addEventListener('click', () => {
  if (scramjetFrame) scramjetFrame.reload();
  else proxyIframe.contentWindow?.location.reload();
  showLoader();
});

btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    browserContainer.requestFullscreen().catch((err) => {
      console.warn(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

// Start proxy initialization on page load
initProxy();
