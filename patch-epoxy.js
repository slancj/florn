const fs = require('fs');
const path = require('path');

const epoxyPath = path.join(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist/index.mjs');

if (fs.existsSync(epoxyPath)) {
  let content = fs.readFileSync(epoxyPath, 'utf8');
  let modified = false;

  // Patch 1: request(...) method headers iteration
  const target1 = `      for (let [key, value] of headers) {`;
  if (content.includes(target1)) {
    const replacement1 = `      const headerEntries = (headers && typeof headers === "object" && Symbol.iterator in headers) ? headers : Object.entries(headers || {});
      for (let [key, value] of headerEntries) {`;
    content = content.replace(target1, replacement1);
    modified = true;
    console.log('[patch-epoxy] Applied Patch 1: headers iteration in request().');
  }

  // Patch 2: connect(...) method requestHeaders iteration
  const target2 = `    for (let [key, value] of requestHeaders) {`;
  if (content.includes(target2)) {
    const replacement2 = `    const reqHeaderEntries = (requestHeaders && typeof requestHeaders === "object" && Symbol.iterator in requestHeaders) ? requestHeaders : Object.entries(requestHeaders || {});
    for (let [key, value] of reqHeaderEntries) {`;
    content = content.replace(target2, replacement2);
    modified = true;
    console.log('[patch-epoxy] Applied Patch 2: requestHeaders iteration in connect().');
  }

  if (modified) {
    fs.writeFileSync(epoxyPath, content, 'utf8');
    console.log('[patch-epoxy] Successfully saved patched epoxy-transport.');
  } else {
    console.log('[patch-epoxy] Epoxy patches already applied or targets not found.');
  }
} else {
  console.log('[patch-epoxy] epoxy-transport not found, skipping patch.');
}
