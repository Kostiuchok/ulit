"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { useEffect, useState } from "react";

interface ContractBook {
  title: string;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

// The platform contract is signed once, by the author, and covers every book
// (see /dashboard/settings/contract) — this page is just a book-scoped bridge
// to that single source of truth, not a per-book signing flow anymore.
export default function BookContractPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const { book, loading: bookLoading } = useBook<ContractBook>(id);
  const [contractAcceptedAt, setContractAcceptedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ user: { contractAcceptedAt: string | null } }>("/api/users/me")
      .then(({ user }) => setContractAcceptedAt(user.contractAcceptedAt))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (bookLoading || loading) {
    return <div className="p-8 animate-pulse text-gray-400">Завантаження…</div>;
  }
  if (!book) return null;

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <Link href={`/dashboard/books/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {book.title}
        </Link>

        <div className="mt-4 mb-6 flex items-center gap-3">
          <FileText className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Договір з платформою</h1>
            <p className="text-sm text-gray-500">Договір укладається один раз і поширюється на всі ваші книги</p>
          </div>
        </div>

        {contractAcceptedAt ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-1">
            <p className="font-semibold text-green-800">✓ Договір з платформою підписано {fmt(contractAcceptedAt)}</p>
            <p className="text-sm text-green-700">
              Ці умови вже застосовуються до книги «{book.title}» — підписувати договір повторно не потрібно.
            </p>
            <Link
              href="/dashboard/settings/contract"
              className="inline-block mt-2 text-sm font-semibold text-green-800 underline hover:no-underline"
            >
              Переглянути умови договору →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
            <p className="text-sm text-amber-800">
              Щоб надіслати книгу на модерацію, спочатку підпишіть договір з платформою — це робиться один раз
              у профілі автора і діє на всі ваші книги.
            </p>
            <Link
              href="/dashboard/settings/contract"
              className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "#ff5900" }}
            >
              Підписати договір
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
