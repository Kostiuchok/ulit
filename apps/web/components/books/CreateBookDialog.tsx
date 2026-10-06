"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/useApi";

const TITLE_MAX_LENGTH = 255; // apps/api books.ts createSchema

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Creating a book takes its title and nothing else (owner's decision
// 2026-10-06; this replaced the four-step wizard). The draft opens on its
// own dashboard, where «Наступний крок» leads through everything the wizard
// used to ask for -- and the title itself can still be changed there.
export function CreateBookDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { apiFetch } = useApi();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // A clean form every time it opens.
  useEffect(() => {
    if (open) {
      setTitle("");
      setError("");
    }
  }, [open]);

  const trimmed = title.trim();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || creating) return;
    setCreating(true);
    setError("");
    try {
      const { book } = await apiFetch<{ book: { id: string } }>("/api/books", {
        method: "POST",
        body: JSON.stringify({ title: trimmed }),
      });
      // The sidebar and «Мої книги» reload their lists.
      window.dispatchEvent(new Event("ulit:books-changed"));
      onOpenChange(false);
      router.push(`/dashboard/books/${book.id}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Не вдалося створити книгу. Спробуйте ще раз.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !creating && onOpenChange(next)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogTitle className="text-base font-semibold text-gray-900">Нова книга</DialogTitle>
        <DialogDescription className="min-w-0 break-words text-sm text-gray-600">
          Вкажіть назву — її можна буде змінити. Рукопис, обкладинку й ціну додасте на сторінці книги.
        </DialogDescription>
        <form onSubmit={create} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-book-title">Назва книги</Label>
            <Input
              id="new-book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX_LENGTH}
              autoFocus
              autoComplete="off"
              disabled={creating}
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Скасувати
            </Button>
            <Button type="submit" disabled={!trimmed || creating}>
              {creating ? "Створення…" : "Створити книжку"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
