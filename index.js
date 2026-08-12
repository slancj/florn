const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { server: wisp } = require('@mercuryworkshop/wisp-js/server');
const { scramjetPath } = require('@mercuryworkshop/scramjet/path');

const app = express();
const PORT = process.env.PORT || 7860;
const HOST = '0.0.0.0';

// Serve Scramjet, BareMux, Epoxy static assets with headers for service worker support
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

app.use('/scramjet/', (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
}, express.static(scramjetPath));

app.use('/baremux/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/bare-mux/dist')));
app.use('/epoxy/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist')));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

// Handle Wisp WebSocket upgrades for proxy traffic
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Scramjet Web Proxy running at http://${HOST}:${PORT}`);
});
