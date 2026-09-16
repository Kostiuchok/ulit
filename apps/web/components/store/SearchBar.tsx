"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  initialValue?: string;
}

export function SearchBar({ initialValue = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    params.delete("cursor");
    startTransition(() => {
      router.push(`/books?${params.toString()}`);
    });
  }

  function handleClear() {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("cursor");
    startTransition(() => {
      router.push(`/books?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Пошук книг та авторів…"
        className="h-11 w-full rounded-full border-gray-300 bg-white pl-5 pr-12 shadow-sm focus-visible:ring-gray-200"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-12 top-1/2 h-auto w-auto -translate-y-1/2 p-1 text-gray-400 hover:bg-transparent hover:text-gray-600"
          aria-label="Очистити"
        >
          ✕
        </Button>
      )}
      <Button
        type="submit"
        size="icon"
        disabled={isPending}
        className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-gray-900 hover:bg-gray-700"
        aria-label="Шукати"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </Button>
    </form>
  );
}
