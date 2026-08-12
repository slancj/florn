import { BareMuxConnection } from "/baremux/index.mjs";

let scramjet = null;
let scramjetFrame = null;

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

// Initialize Proxy Engine
async function initProxy() {
  try {
    statusText.textContent = 'Connecting...';
    
    // Connect BareMux to Wisp backend via Epoxy
    const connection = new BareMuxConnection("/baremux/worker.js");
    const wispProtocol = location.protocol === "https:" ? "wss://" : "ws://";
    const wispUrl = `${wispProtocol}${location.host}/wisp/`;
    
    await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);

    // Initialize Scramjet Controller
    const { ScramjetController } = $scramjetLoadController();
    scramjet = new ScramjetController({
      prefix: "/scramjet/",
      files: {
        wasm: "/scramjet/scramjet.wasm.wasm",
        all: "/scramjet/scramjet.all.js",
        sync: "/scramjet/scramjet.sync.js",
      },
      flags: {
        serviceworkers: false,
      },
    });

    await scramjet.init();
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

  // Check if it's a URL
  if (/^https?:\/\//i.test(query)) {
    return query;
  }
  
  if (query.includes('.') && !query.includes(' ')) {
    return 'https://' + query;
  }

  // Otherwise, treat as search query
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
  iframeLoader.classList.remove('hidden');

  scramjetFrame.go(finalUrl);
}

// Hide loader when iframe finishes loading
proxyIframe.addEventListener('load', () => {
  iframeLoader.classList.add('hidden');
});

// Event Listeners
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  launchUrl(urlInput.value);
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
  if (scramjetFrame) scramjetFrame.back();
});

btnForward.addEventListener('click', () => {
  if (scramjetFrame) scramjetFrame.forward();
});

btnReload.addEventListener('click', () => {
  if (scramjetFrame) {
    iframeLoader.classList.remove('hidden');
    scramjetFrame.reload();
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

// Start initialization on DOM load
window.addEventListener('DOMContentLoaded', initProxy);
