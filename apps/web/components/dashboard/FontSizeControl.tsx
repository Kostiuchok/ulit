"use client";

import { useEffect, useState } from "react";

const MIN = 87.5;
const MAX = 137.5;
const STEP = 12.5;
const STORAGE_KEY = "ulit-font-scale";

export function FontSizeControl() {
  const [scale, setScale] = useState(100);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      setScale(saved);
      document.documentElement.style.fontSize = `${saved}%`;
    }
  }, []);

  function apply(next: number) {
    const clamped = Math.min(MAX, Math.max(MIN, next));
    setScale(clamped);
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  return (
    <div className="flex items-center gap-1 rounded border border-gray-400/50 px-1.5 py-0.5">
      <button
        onClick={() => apply(scale - STEP)}
        title="Зменшити розмір шрифту інтерфейсу"
        className="text-xs font-bold text-black hover:opacity-60"
      >
        A−
      </button>
      <span className="text-[0.75rem] text-gray-500 tabular-nums">{Math.round(scale)}%</span>
      <button
        onClick={() => apply(scale + STEP)}
        title="Збільшити розмір шрифту інтерфейсу"
        className="text-sm font-bold text-black hover:opacity-60"
      >
        A+
      </button>
    </div>
  );
}
