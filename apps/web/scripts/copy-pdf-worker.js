// react-pdf's pdf.js worker can't go through webpack/Terser as a bundled
// module -- Next.js's build fails on it ('import.meta' cannot be used
// outside of module code) because pdf.js's worker file uses import.meta
// internally and Terser processes it as a plain script, not ESM. The fix
// react-pdf itself documents for Next.js: serve the worker as a static
// public asset instead of importing it, so webpack never touches it.
// Copied fresh from node_modules (not committed) so it always matches the
// installed pdfjs-dist version -- react-pdf throws a hard runtime error if
// the worker and API versions ever drift apart.
const fs = require("fs");
const path = require("path");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

fs.copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} -> ${dest}`);
