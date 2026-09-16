"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../../hooks/useApi";
import { cn } from "../../../../lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SourceStat {
  source: string;
  revenue: number;
  count: number;
}

interface BookStat {
  book: { id: string; title: string; coverUrl: string | null; status: string };
  unitsSoldSite: number;
  sources: SourceStat[];
}

const SOURCE_LABEL: Record<string, string> = {
  SITE: "Ulit",
  D2D: "Draft2Digital",
  KDP: "Amazon KDP",
  GOOGLE: "Google Play Books",
};

function fmt(amount: number) {
  return `${amount.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
}

const FILTER_TABS = [
  { key: "ulit", label: "У магазині Ulit" },
  { key: "all", label: "Усі майданчики" },
] as const;

export default function StatsPage() {
  const { apiFetch, token } = useApi();
  const [stats, setStats] = useState<BookStat[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ulit" | "all">("ulit");

  useEffect(() => {
    if (!token) return;
    apiFetch<{ stats: BookStat[] }>("/api/authors/me/stats")
      .then((d) => setStats(d.stats))
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
  if (!stats) return null;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Загальна статистика</h1>
          <p className="mt-1 text-sm text-gray-500">
            Продажі та роялті по ваших книгах — на основі реальних замовлень і нарахувань.
          </p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as "ulit" | "all")}>
          <TabsList className="h-auto justify-start gap-6 rounded-none border-b bg-transparent p-0 text-xs font-semibold uppercase tracking-wide">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 text-gray-400 shadow-none",
                  "data-[state=active]:bg-transparent data-[state=active]:text-gray-900 data-[state=active]:shadow-none",
                  "hover:text-gray-600 data-[state=active]:border-current"
                )}
                style={filter === tab.key ? { color: "#ff5900" } : undefined}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {stats.length === 0 && (
          <p className="text-sm text-gray-400">У вас ще немає книг.</p>
        )}

        <div className="space-y-4">
          {stats.map((s) => {
            const sources = filter === "ulit" ? s.sources.filter((src) => src.source === "SITE") : s.sources;
            return (
              <Card key={s.book.id} className="shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    {s.book.coverUrl ? (
                      <img src={s.book.coverUrl} alt="" className="h-16 w-12 rounded object-cover" />
                    ) : (
                      <div className="h-16 w-12 rounded bg-gray-100" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{s.book.title}</p>
                      <p className="text-xs text-gray-400">Продано на сайті: {s.unitsSoldSite} прим.</p>
                    </div>
                  </div>

                  {sources.length > 0 ? (
                    <Table>
                      <TableHeader className="text-xs uppercase tracking-wide text-gray-400">
                        <TableRow>
                          <TableHead className="h-auto px-0 py-1.5 font-semibold text-gray-400">Канал</TableHead>
                          <TableHead className="h-auto px-0 py-1.5 text-right font-semibold text-gray-400">Нарахувань</TableHead>
                          <TableHead className="h-auto px-0 py-1.5 text-right font-semibold text-gray-400">Дохід (роялті)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sources.map((src) => (
                          <TableRow key={src.source}>
                            <TableCell className="px-0 py-1.5 text-gray-700">{SOURCE_LABEL[src.source] ?? src.source}</TableCell>
                            <TableCell className="px-0 py-1.5 text-right text-gray-500">{src.count}</TableCell>
                            <TableCell className="px-0 py-1.5 text-right font-medium text-gray-900">{fmt(src.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-xs text-gray-400">Продажів у цій категорії поки не було.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
