// pdf.js (pulled in by react-pdf, used only by PrintFlipViewer) calls
// Promise.withResolvers() unconditionally, with no fallback of its own --
// that method only landed in Chrome 119 / Safari 17.4 / Firefox 121 (mid-
// 2024), so any older browser throws `TypeError: Promise.withResolvers is
// not a function` the instant pdf.js's module code runs, which is what an
// author actually saw as "Application error: a client-side exception has
// occurred" on the manuscript preview page (confirmed from their own
// DevTools console: the throw traced into pdf.js's sendWithPromise/
// ReadableStream internals). Side-effect-only module: import it, don't call
// anything from it. Must be the FIRST import in any file that (transitively)
// imports "react-pdf" -- sibling imports in one file evaluate in the order
// they're written, so this patches the global before pdf.js's own module
// code runs.
if (typeof Promise.withResolvers !== "function") {
  (Promise as any).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
