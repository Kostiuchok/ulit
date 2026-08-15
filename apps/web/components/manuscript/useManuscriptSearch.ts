import { useCallback, useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";

interface Match {
  from: number;
  to: number;
}

// (8) "Пошук" — the search half of T-1959's cleanup menu. Case-insensitive,
// scoped to single text nodes (won't find a match that straddles a mark
// boundary, e.g. half-bold text) -- acceptable for jump-to-text navigation.
// No replace here; that's separate, still-open toolbar scope (T-1942).
function findMatches(editor: Editor, query: string): Match[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const matches: Match[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let idx = text.indexOf(q);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + q.length });
      idx = text.indexOf(q, idx + q.length);
    }
  });
  return matches;
}

function selectMatch(editor: Editor, match: Match) {
  editor.chain().setTextSelection({ from: match.from, to: match.to }).run();
  const dom = editor.view.domAtPos(match.from).node as Node;
  const el = dom.nodeType === 1 ? (dom as HTMLElement) : dom.parentElement;
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function useManuscriptSearch(editor: Editor | null) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const matches = useMemo(() => (editor && open ? findMatches(editor, query) : []), [editor, open, query]);

  const goTo = useCallback(
    (i: number) => {
      if (!editor || matches.length === 0) return;
      const wrapped = ((i % matches.length) + matches.length) % matches.length;
      setIndex(wrapped);
      selectMatch(editor, matches[wrapped]);
    },
    [editor, matches]
  );

  // Jump to the first match as soon as a new query resolves matches, instead
  // of leaving the previous selection/scroll position stale.
  useEffect(() => {
    if (matches.length === 0 || !editor) return;
    setIndex(0);
    selectMatch(editor, matches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  function next() {
    goTo(index + 1);
  }
  function prev() {
    goTo(index - 1);
  }

  function openSearch() {
    setOpen(true);
  }
  function closeSearch() {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setIndex(0);
  }

  return { open, query, index, matches, openSearch, closeSearch, onQueryChange, next, prev, goTo };
}
