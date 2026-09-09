// react-pdf's pdf.js worker can't go through webpack/Terser as a bundled
// module -- Next.js's build fails on it ('import.meta' cannot be used
// outside of module code) because pdf.js's worker file uses import.meta
// internally and Terser processes it as a plain script, not ESM. The fix
// react-pdf itself documents for Next.js: serve the worker as a static
// public asset instead of importing it, so webpack never touches it.
// Copied fresh from node_modules (not committed) so it always matches the
// installed pdfjs-dist version -- react-pdf throws a hard runtime error if
// the worker and API versions ever drift apart.
// The worker runs in its own global scope (a real Web Worker), so
// apps/web/lib/pdfJsPolyfills.ts -- which patches the MAIN thread's
// Promise/URL globals before "react-pdf" loads -- never reaches it. pdf.js
// itself calls both Promise.withResolvers() and URL.parse() unguarded from
// inside the worker too (createValidAbsoluteUrl/updateUrlHash, hit whenever
// a PDF has a link annotation; sendWithPromise's RPC plumbing, hit on every
// page). Confirmed twice in production already from the main-thread side
// (an author's own DevTools console) before either got patched; prepending
// the same fallback here, plain JS, keeps the worker from being the next
// place the same class of crash turns up instead of the main thread.
// Keep in sync with pdfJsPolyfills.ts if a third API ever needs patching.
const WORKER_POLYFILL_PRELUDE = `
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}
if (typeof URL.parse !== "function") {
  URL.parse = function parse(url, base) {
    try { return new URL(url, base); } catch { return null; }
  };
}
`;

const fs = require("fs");
const path = require("path");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

fs.writeFileSync(dest, WORKER_POLYFILL_PRELUDE + fs.readFileSync(src, "utf-8"));
console.log(`[copy-pdf-worker] ${src} -> ${dest} (+ Promise.withResolvers/URL.parse prelude)`);
