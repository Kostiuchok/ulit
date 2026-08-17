// T-1953/T-1962 front matter always ends in a horizontalRule sentinel --
// the body starts right after it. Pure, DOM-free -- safe to run both in the
// browser (paginateManuscript.ts) and in the print-PDF worker (T-2057).
export function splitFrontMatter(content: any[]): { front: any[]; body: any[] } {
  const ruleIdx = content.slice(0, 15).findIndex((n) => n?.type === "horizontalRule");
  if (ruleIdx === -1) return { front: [], body: content };
  return { front: content.slice(0, ruleIdx + 1), body: content.slice(ruleIdx + 1) };
}
