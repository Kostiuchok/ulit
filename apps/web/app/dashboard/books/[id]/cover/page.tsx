"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CoverDesigner } from "@/components/books/CoverDesigner";
import type { CoverFormat } from "@/components/books/CoverDesignerCanvas";
import { useApi } from "@/hooks/useApi";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { parseRejectedConcerns } from "@/lib/rejectedBlocks";

interface BookInfo {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  isbn?: string | null;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  coverDesign?: { front: any[]; backSpine: any[]; background: { color: string; imageUrl?: string } } | null;
  coverImageLibrary?: { url: string; uploadedAt: string; kind?: "slot" | "background" }[] | null;
  pageCount?: number | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
}

const FORMATS: { key: CoverFormat; label: string }[] = [
  { key: "ebook", label: "Електронна версія" },
  { key: "softcover", label: "М'яка обкладинка" },
  { key: "hardcover", label: "Тверда обкладинка" },
];

export default function CoverPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const { data: session } = useSession();
  const [book, setBook] = useState<BookInfo | null>(null);
  const [authorBio, setAuthorBio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<CoverFormat>("ebook");
  const [saved, setSaved] = useState(false);
  const [locallyFixed, setLocallyFixed] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: BookInfo }>(`/api/books/${id}`)
      .then(({ book }) => setBook(book))
      .finally(() => setLoading(false));
    apiFetch<{ user: { bio?: string | null } }>("/api/users/me")
      .then(({ user }) => setAuthorBio(user.bio ?? null))
      .catch(() => {});
  }, [token, id]);

  function handleSaved(patch: { coverUrl?: string; backCoverUrl?: string }) {
    setBook((b) => (b ? { ...b, ...patch } : b));
    setSaved(true);
    setLocallyFixed(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleLibraryChange(library: { url: string; uploadedAt: string; kind?: "slot" | "background" }[]) {
    setBook((b) => (b ? { ...b, coverImageLibrary: library } : b));
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 px-6 py-3">
        <Link
          href={`/dashboard/books/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={14} className="shrink-0" />
          Обкладинка
        </Link>

        <div className="flex gap-1 rounded-lg border p-1 bg-gray-50">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                format === f.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Link
          href={`/dashboard/books/${id}/preview`}
          className="ml-auto text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Передперегляд →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {saved && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            ✓ Обкладинку збережено
          </div>
        )}

        {book && parseRejectedConcerns(book).cover && !locallyFixed && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            Модератор зазначив зауваження щодо обкладинки: {book.moderationNote}
          </div>
        )}

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <CoverDesigner
            bookId={id}
            bookTitle={book?.title ?? "Назва книги"}
            bookAuthor={session?.user?.name ?? "Автор"}
            subtitle={book?.subtitle}
            description={book?.description}
            authorBio={authorBio}
            isbn={book?.isbn}
            pageCount={book?.pageCount}
            format={format}
            existingCoverUrl={book?.coverUrl}
            savedDesign={book?.coverDesign}
            coverImageLibrary={book?.coverImageLibrary ?? []}
            onSaved={handleSaved}
            onLibraryChange={handleLibraryChange}
            token={token}
          />
        </div>

        <p className="mt-3 text-xs text-gray-400 text-center">
          Обкладинка буде збережена у форматі PNG 1800×2700 px (300 DPI) на панель
        </p>
      </div>
    </div>
  );
}
