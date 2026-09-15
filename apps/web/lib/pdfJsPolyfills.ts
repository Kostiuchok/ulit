// pdfjs-dist v5 (pulled in by react-pdf, used only by PrintFlipViewer) calls
// several very recent JS built-ins unconditionally, with no fallback of its
// own -- each one throws (not warns) the instant pdf.js's module code runs
// on a browser old enough to lack it, which is what surfaced to an author as
// "Application error: a client-side exception has occurred" on the
// manuscript preview page. Confirmed two so far from the author's own
// DevTools console, one at a time as each got patched and the next one
// underneath it became visible:
//   - Promise.withResolvers() -- Chrome 119 / Safari 17.4 / Firefox 121
//     (mid-2024)
//   - URL.parse() -- Chrome 126 / Safari 17 (mid-2024), even newer/less
//     supported than the above
// Both missing on the same browser points at something that predates
// mid-2024 entirely, not two isolated gaps -- more of pdf.js v5's other
// 2024-era API usage may still be lurking behind these; add the fallback
// here if a new one surfaces rather than downgrading pdfjs-dist, unless
// this keeps recurring (at that point a v4 downgrade -- broadly compatible,
// was the stable choice for years -- is the more sustainable fix).
//   - ArrayBuffer.prototype.transferToFixedLength() -- Chrome 114 / Safari
//     17.4 (2023/2024) -- third one found (author report: every page's
//     image/graphics silently dropped -- pdf.js's own per-task try/catch
//     logs "ignoring errors during GetOperatorList" and keeps going, so
//     this one degrades instead of throwing outright, but the visible
//     result is the same: the manuscript preview looks broken/empty).
// Side-effect-only module: import it, don't call anything from it. Must be
// the FIRST import in any file that (transitively) imports "react-pdf" --
// sibling imports in one file evaluate in the order they're written, so
// this patches the globals before pdf.js's own module code runs.
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

if (typeof URL.parse !== "function") {
  // Spec: returns a URL on success, null on an invalid input -- unlike
  // `new URL(...)`, which throws instead.
  (URL as any).parse = function parse(url: string, base?: string): URL | null {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

if (typeof ArrayBuffer.prototype.transferToFixedLength !== "function") {
  // Spec detaches the source buffer; callers here only ever use the
  // returned buffer and drop their reference to the old one, so a
  // non-detaching copy is behaviorally equivalent for pdf.js's purposes.
  (ArrayBuffer.prototype as any).transferToFixedLength = function transferToFixedLength(
    this: ArrayBuffer,
    newByteLength?: number
  ): ArrayBuffer {
    const newLength = newByteLength === undefined ? this.byteLength : newByteLength;
    const newBuffer = new ArrayBuffer(newLength);
    new Uint8Array(newBuffer).set(new Uint8Array(this, 0, Math.min(this.byteLength, newLength)));
    return newBuffer;
  };
}
