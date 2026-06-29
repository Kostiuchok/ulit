"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CoverDesigner } from "../../../../../components/books/CoverDesigner";
import { useApi } from "../../../../../hooks/useApi";
import { useSession } from "next-auth/react";

interface BookInfo {
  id: string;
  title: string;
  coverUrl?: string | null;
  author?: { name: string };
}

export default function CoverPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch, token } = useApi();
  const { data: session } = useSession();
  const [book, setBook] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: BookInfo }>(`/api/books/${id}`)
      .then(({ book }) => setBook(book))
      .catch(() => router.push("/dashboard/books"))
      .finally(() => setLoading(false));
  }, [token, id]);

  function handleSaved(url: string) {
    setBook((b) => b ? { ...b, coverUrl: url } : b);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/dashboard/books/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← {book?.title}
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold text-gray-900">Редактор обкладинки</h1>
        </div>

        {saved && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            ✓ Обкладинку збережено
          </div>
        )}

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <CoverDesigner
            bookId={id}
            bookTitle={book?.title ?? "Назва книги"}
            bookAuthor={session?.user?.name ?? "Автор"}
            existingCoverUrl={book?.coverUrl}
            onSaved={handleSaved}
            token={token}
          />
        </div>

        <p className="mt-3 text-xs text-gray-400 text-center">
          Обкладинка буде збережена у форматі PNG 1800×2700 px (300 DPI)
        </p>
      </div>
    </div>
  );
}
