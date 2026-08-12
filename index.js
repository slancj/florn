const express = require('express');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { server: wisp } = require('@mercuryworkshop/wisp-js/server');

// Robustly resolve Scramjet static assets directory
let scramjetPath;
try {
  scramjetPath = require('@mercuryworkshop/scramjet/path').scramjetPath;
} catch (e) { }

if (!scramjetPath || !fs.existsSync(scramjetPath)) {
  const candidate1 = path.join(__dirname, 'node_modules', '@mercuryworkshop', 'scramjet', 'dist');
  const candidate2 = path.join(__dirname, 'node_modules', '@mercuryworkshop', 'scramjet');
  if (fs.existsSync(candidate1)) {
    scramjetPath = candidate1;
  } else if (fs.existsSync(candidate2)) {
    scramjetPath = candidate2;
  } else {
    console.error('[Error] Scramjet dist directory not found in node_modules!');
  }
}

console.log('[Server] Serving Scramjet static assets from:', scramjetPath);

const app = express();
const PORT = process.env.PORT || 7860;
const HOST = '0.0.0.0';

// Global middleware: Service Worker scope + COOP / COEP credentialless
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  next();
});

// Serve service worker with no-cache headers
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Serve bare-mux worker with no-cache headers
app.get('/baremux/worker.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'node_modules', '@mercuryworkshop', 'bare-mux', 'dist', 'worker.js'));
});

// Serve static assets from dependencies
if (scramjetPath) {
  app.use('/scramjet/', express.static(scramjetPath));
}
app.use('/baremux/', express.static(path.join(__dirname, 'node_modules', '@mercuryworkshop', 'bare-mux', 'dist')));
app.use('/epoxy/', express.static(path.join(__dirname, 'node_modules', '@mercuryworkshop', 'epoxy-transport', 'dist')));

// Serve public directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

// Handle Wisp WebSocket upgrades safely
server.on('upgrade', (req, socket, head) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (reqUrl.pathname.startsWith('/wisp/')) {
      wisp.routeRequest(req, socket, head);
    } else {
      socket.destroy();
    }
  } catch (err) {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Scramjet Web Proxy running at http://${HOST}:${PORT}`);
});
