"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

interface Book {
  id: string;
  title: string;
  status: string;
  coverUrl?: string | null;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
  author: { name: string };
}

// Same live-statuses definition as the backend where-clause (SENT/PUBLISHED
// -- WITHDRAWN/ERROR/NOT_SENT don't need any further admin action here).
const LIVE = new Set(["SENT", "PUBLISHED"]);

const STATUS_LABELS: Record<string, string> = {
  ARCHIVED: "Видалено автором",
  UNPUBLISHED: "Знято з продажу",
};

export default function WithdrawalQueuePage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      return apiFetch<{ books: Book[] }>("/api/admin/withdrawal-queue")
        .then((d) => setBooks(d.books))
        .finally(() => { if (!opts?.silent) setLoading(false); });
    },
    [token, apiFetch]
  );

  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(useCallback(() => load({ silent: true }), [load]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Потребують відкликання</h1>
        <p className="text-sm text-gray-500 mt-1">
          Автор прибрав ці книги з Ulit (видалив або зняв з продажу), але вони й досі числяться живими на
          зовнішніх сервісах — D2D/KDP/Google не мають автоматичного API для відкликання, зробіть це вручну на
          самому сервісі, після чого позначте канал «WITHDRAWN» на сторінці розсилки книги.
        </p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500">Черга порожня — немає книг, що потребують ручного відкликання</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Книга</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Статус на Ulit</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Ще живі канали</TableHead>
                <TableHead className="h-auto px-4 py-3 text-right font-semibold text-gray-600">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((book) => {
                const live: string[] = [];
                if (LIVE.has(book.d2dStatus)) live.push("D2D");
                if (LIVE.has(book.kdpStatus)) live.push("KDP");
                if (LIVE.has(book.googleStatus)) live.push("Google");
                return (
                  <TableRow key={book.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt="" className="h-10 w-7 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-7 rounded bg-gray-100 flex items-center justify-center text-sm">📖</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{book.title}</p>
                          <p className="text-xs text-gray-500">{book.author.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary" className="rounded-full font-medium text-gray-600 hover:bg-secondary">
                        {STATUS_LABELS[book.status] ?? book.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-xs font-medium text-red-600">{live.join(", ")}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700 hover:bg-blue-100">
                        <Link href={`/admin/books/${book.id}/distribute`}>Відкрити →</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
