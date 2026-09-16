"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../../hooks/useApi";
import { useRefetchOnFocus } from "../../../../hooks/useRefetchOnFocus";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { cn } from "../../../../lib/utils";

interface Book {
  id: string;
  title: string;
  isbn?: string | null;
  coverUrl?: string | null;
  distributionStrategy: string;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
  publishedAt?: string | null;
  author: { name: string };
}

export default function DistributionQueuePage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      return apiFetch<{ books: Book[] }>("/api/admin/distribution/queue")
        .then((d) => setBooks(d.books))
        .finally(() => { if (!opts?.silent) setLoading(false); });
    },
    [token, apiFetch]
  );

  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(useCallback(() => load({ silent: true }), [load]));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === books.length) setSelected(new Set());
    else setSelected(new Set(books.map((b) => b.id)));
  }

  const isKdpOnly = (b: Book) => b.distributionStrategy === "KDP_SELECT";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Черга дистрибуції</h1>
          <p className="text-sm text-gray-500 mt-1">Книги готові до відправки на зовнішні сервіси</p>
        </div>
        {selected.size > 0 && (
          <Button asChild className="bg-gray-900 hover:bg-gray-700">
            <Link href={`/admin/distribution/bulk?ids=${Array.from(selected).join(",")}`}>
              📦 Масово ({selected.size})
            </Link>
          </Button>
        )}
      </div>

      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500">Черга порожня — всі книги розіслані</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="h-auto px-4 py-3">
                  <Checkbox checked={selected.size === books.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Книга</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Стратегія</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">D2D / KDP / Google</TableHead>
                <TableHead className="h-auto px-4 py-3 text-right font-semibold text-gray-600">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="px-4 py-3">
                    <Checkbox checked={selected.has(book.id)} onCheckedChange={() => toggle(book.id)} />
                  </TableCell>
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
                    <Badge
                      className={cn(
                        "rounded-full border-transparent font-medium",
                        isKdpOnly(book) ? "bg-orange-100 text-orange-700 hover:bg-orange-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                      )}
                    >
                      {isKdpOnly(book) ? "KDP Select" : "Широке"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {!isKdpOnly(book) && (
                        <span className={book.d2dStatus === "NOT_SENT" ? "text-red-500 font-medium" : "text-gray-400"}>
                          D2D: {book.d2dStatus}
                        </span>
                      )}
                      <span className={book.kdpStatus === "NOT_SENT" ? "text-red-500 font-medium" : "text-gray-400"}>
                        KDP: {book.kdpStatus}
                      </span>
                      {!isKdpOnly(book) && (
                        <span className={book.googleStatus === "NOT_SENT" ? "text-red-500 font-medium" : "text-gray-400"}>
                          G: {book.googleStatus}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700 hover:bg-blue-100">
                      <Link href={`/admin/books/${book.id}/distribute`}>Розіслати →</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
