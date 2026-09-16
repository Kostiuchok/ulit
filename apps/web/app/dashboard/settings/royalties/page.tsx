"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../../hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Royalty {
  id: string;
  amount: number;
  source: string;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  createdAt: string;
  book: { id: string; title: string };
}

interface RoyaltiesResponse {
  summary: { earned: number; paid: number; pending: number };
  royalties: Royalty[];
}

function fmt(amount: number) {
  return `${amount.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export default function RoyaltiesPage() {
  const { apiFetch, token } = useApi();
  const [data, setData] = useState<RoyaltiesResponse | null>(null);
  const [identityConfirmed, setIdentityConfirmed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<RoyaltiesResponse>("/api/royalties/me"),
      apiFetch<{ user: { contractAcceptedAt: string | null } }>("/api/users/me"),
    ])
      .then(([royalties, me]) => {
        setData(royalties);
        setIdentityConfirmed(!!me.user.contractAcceptedAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto animate-pulse text-center text-gray-400">Завантаження…</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Авторські відрахування</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardContent className="space-y-3 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Сума до виплати</p>
              <p className="text-2xl font-bold" style={{ color: "#ff5900" }}>{fmt(data.summary.pending)}</p>
              <p className="text-sm text-gray-500">
                Виведення авторських відрахувань займає <span className="font-semibold text-gray-700">до 30 робочих днів</span>.
              </p>
              {!identityConfirmed && (
                <Button asChild style={{ backgroundColor: "#ff5900" }}>
                  <Link href="/dashboard/settings/contract">Підтвердити особу</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Статистика виплат</p>
              <dl className="space-y-3">
                <div className="flex items-center justify-between border-b pb-3 text-sm">
                  <dt className="text-gray-500">Зароблено за весь час</dt>
                  <dd className="font-semibold" style={{ color: "#ff5900" }}>{fmt(data.summary.earned)}</dd>
                </div>
                <div className="flex items-center justify-between border-b pb-3 text-sm">
                  <dt className="text-gray-500">Виведено</dt>
                  <dd className="font-semibold text-gray-900">{fmt(data.summary.paid)}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-500">Залишок</dt>
                  <dd className="font-semibold" style={{ color: "#ff5900" }}>{fmt(data.summary.pending)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {data.royalties.length > 0 && (
          <Card className="overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <TableRow>
                  <TableHead className="h-auto px-4 py-3 font-semibold text-gray-500">Книга</TableHead>
                  <TableHead className="h-auto px-4 py-3 font-semibold text-gray-500">Джерело</TableHead>
                  <TableHead className="h-auto px-4 py-3 font-semibold text-gray-500">Дата</TableHead>
                  <TableHead className="h-auto px-4 py-3 font-semibold text-gray-500">Статус</TableHead>
                  <TableHead className="h-auto px-4 py-3 text-right font-semibold text-gray-500">Сума</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.royalties.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-4 py-3 text-gray-900">{r.book.title}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-500">{r.source}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-500">{fmtDate(r.paidAt ?? r.createdAt)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full border-transparent font-medium",
                          r.status === "PAID" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {r.status === "PAID" ? "Виплачено" : "Очікує"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-gray-900">{fmt(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
