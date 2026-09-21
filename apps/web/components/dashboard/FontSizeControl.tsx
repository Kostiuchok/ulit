"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => apply(scale - STEP)}
        title="Зменшити розмір шрифту інтерфейсу"
        className="h-5 w-5 p-0 text-xs font-bold text-black hover:bg-transparent hover:opacity-60"
      >
        A−
      </Button>
      <span className="text-[0.75rem] text-gray-500 tabular-nums">{Math.round(scale)}%</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => apply(scale + STEP)}
        title="Збільшити розмір шрифту інтерфейсу"
        className="h-5 w-5 p-0 text-sm font-bold text-black hover:bg-transparent hover:opacity-60"
      >
        A+
      </Button>
    </div>
  );
}
