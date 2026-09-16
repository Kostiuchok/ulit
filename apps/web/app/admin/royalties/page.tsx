"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../hooks/useApi";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { cn } from "../../../lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const PAYOUT_THRESHOLD = 500;

interface Royalty {
  id: string;
  amount: string;
  source: string;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  author: { id: string; name: string; email: string };
  book: { id: string; title: string; isbn?: string | null };
}

export default function RoyaltiesPage() {
  const { apiFetch, token } = useApi();
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [pendingByAuthor, setPendingByAuthor] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [filter, setFilter] = useState("PENDING");

  const fetchRoyalties = async () => {
    if (!token) return;
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    try {
      const data = await apiFetch<{ royalties: Royalty[]; pendingByAuthor: Record<string, number> }>(
        `/api/admin/royalties${params}`
      );
      setRoyalties(data.royalties);
      setPendingByAuthor(data.pendingByAuthor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoyalties(); }, [token, filter]);

  async function handlePay(id: string) {
    setPaying(id);
    try {
      await apiFetch(`/api/admin/royalties/${id}/pay`, { method: "POST" });
      await fetchRoyalties();
    } finally {
      setPaying(null);
    }
  }

  const totalPending = Object.values(pendingByAuthor).reduce((s, v) => s + v, 0);
  const authorsAboveThreshold = Object.entries(pendingByAuthor).filter(([, v]) => v >= PAYOUT_THRESHOLD);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Роялті</h1>
          <p className="text-sm text-gray-500 mt-1">Виплати авторам за продажі на платформі</p>
        </div>
        <Button asChild variant="outline" className="shadow-sm">
          <a href={`${API_URL}/api/admin/royalties/export`}>⬇ CSV</a>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 shadow-sm">
          <p className="text-xs text-gray-500">Очікують виплати</p>
          <p className="text-2xl font-bold text-orange-600">{totalPending.toFixed(2)} грн</p>
        </Card>
        <Card className="p-4 shadow-sm">
          <p className="text-xs text-gray-500">Авторів понад {PAYOUT_THRESHOLD} грн</p>
          <p className="text-2xl font-bold text-red-600">{authorsAboveThreshold.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Готові до виплати</p>
        </Card>
        <Card className="p-4 shadow-sm">
          <p className="text-xs text-gray-500">Поріг виплати</p>
          <p className="text-2xl font-bold text-gray-900">{PAYOUT_THRESHOLD} грн</p>
        </Card>
      </div>

      {/* Authors above threshold */}
      {authorsAboveThreshold.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800 mb-2">
            ⚠️ {authorsAboveThreshold.length} авторів очікують виплату ({PAYOUT_THRESHOLD}+ грн):
          </p>
          <div className="flex flex-wrap gap-2">
            {authorsAboveThreshold.map(([authorId, amount]) => {
              const r = royalties.find((r) => r.author.id === authorId);
              return r ? (
                <Badge key={authorId} variant="outline" className="rounded-full border-orange-200 bg-orange-100 font-medium text-orange-800 hover:bg-orange-100">
                  {r.author.name}: {amount.toFixed(2)} грн
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {["PENDING", "PAID", ""].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
            className={cn("h-auto rounded-full px-4 py-1.5", filter === s && "bg-gray-900 hover:bg-gray-900")}
          >
            {s || "Всі"}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : royalties.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Записів немає</div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Автор</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Книга</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Сума</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Джерело</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Статус</TableHead>
                <TableHead className="h-auto px-4 py-3 text-right font-semibold text-gray-600">Дія</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {royalties.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.author.name}</p>
                    <p className="text-xs text-gray-500">{r.author.email}</p>
                    {pendingByAuthor[r.author.id] >= PAYOUT_THRESHOLD && r.status === "PENDING" && (
                      <span className="text-xs text-orange-600 font-medium">
                        💰 {pendingByAuthor[r.author.id].toFixed(0)} грн pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <p className="text-gray-900 truncate max-w-[180px]">{r.book.title}</p>
                    {r.book.isbn && <p className="text-xs font-mono text-gray-400">{r.book.isbn}</p>}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-semibold text-gray-900">
                    {Number(r.amount).toFixed(2)} грн
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="secondary" className="rounded-full font-medium text-gray-600 hover:bg-secondary">
                      {r.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      className={cn(
                        "rounded-full border-transparent font-medium",
                        r.status === "PAID" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                      )}
                    >
                      {r.status === "PAID" ? "✓ Виплачено" : "Очікує"}
                    </Badge>
                    {r.paidAt && (
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(r.paidAt).toLocaleDateString("uk-UA")}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {r.status === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => handlePay(r.id)}
                        loading={paying === r.id}
                        className="bg-green-600 text-xs hover:bg-green-700"
                      >
                        Виплатити
                      </Button>
                    )}
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
