"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useApi } from "../../../hooks/useApi";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { cn } from "../../../lib/utils";

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

export default function DistributionPage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

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
    setExported(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setExported(false);
    if (selected.size === books.length) setSelected(new Set());
    else setSelected(new Set(books.map((b) => b.id)));
  }

  const isKdpOnly = (b: Book) => b.distributionStrategy === "KDP_SELECT";

  async function handleExport() {
    if (!selected.size) return;
    setExporting(true);
    setExported(false);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const session = (window as any).__nextAuthSession;
      const authToken = session?.apiToken;

      const res = await fetch(`${apiUrl}/api/admin/distribution/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ bookIds: Array.from(selected) }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "knyha-bulk.zip";
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      load({ silent: true });
    } catch (e: any) {
      toast.error(e.message || "Помилка експорту");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Дистрибуція</h1>
        <p className="text-sm text-gray-500 mt-1">
          Черга книг готових до відправки на зовнішні сервіси та масове завантаження ZIP-пакетів
        </p>
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

      {!loading && books.length > 0 && (
        <Card className="shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Масова відправка</p>
            <p className="text-xs text-gray-500 mt-0.5">
              ZIP-архів з обраними книгами. Завантаження автоматично позначає увімкнені D2D/KDP/Google як «Надіслано».
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Обрано: {selected.size}</span>
            <Button
              onClick={handleExport}
              disabled={!selected.size}
              loading={exporting}
              className="bg-gray-900 hover:bg-gray-700"
            >
              ⬇ Завантажити ZIP
            </Button>
          </div>
        </Card>
      )}

      {exported && (
        <p className="text-center text-sm text-green-700">
          ✓ Завантажено — увімкнені зовнішні сервіси позначено «Надіслано».
        </p>
      )}
    </div>
  );
}
