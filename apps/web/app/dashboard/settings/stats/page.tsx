"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../../hooks/useApi";
import { cn } from "../../../../lib/utils";

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
    return <div className="p-8 animate-pulse text-gray-400">Завантаження…</div>;
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

        <div className="flex gap-6 border-b text-xs font-semibold uppercase tracking-wide">
          {[
            { key: "ulit" as const, label: "У магазині Ulit" },
            { key: "all" as const, label: "Усі майданчики" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "pb-2 border-b-2 transition-colors",
                filter === tab.key ? "border-current text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
              style={filter === tab.key ? { color: "#ff5900", borderColor: "#ff5900" } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {stats.length === 0 && (
          <p className="text-sm text-gray-400">У вас ще немає книг.</p>
        )}

        <div className="space-y-4">
          {stats.map((s) => {
            const sources = filter === "ulit" ? s.sources.filter((src) => src.source === "SITE") : s.sources;
            return (
              <div key={s.book.id} className="rounded-xl border bg-white p-5 shadow-sm">
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
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="text-left py-1.5 font-semibold">Канал</th>
                        <th className="text-right py-1.5 font-semibold">Нарахувань</th>
                        <th className="text-right py-1.5 font-semibold">Дохід (роялті)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sources.map((src) => (
                        <tr key={src.source}>
                          <td className="py-1.5 text-gray-700">{SOURCE_LABEL[src.source] ?? src.source}</td>
                          <td className="py-1.5 text-right text-gray-500">{src.count}</td>
                          <td className="py-1.5 text-right font-medium text-gray-900">{fmt(src.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-gray-400">Продажів у цій категорії поки не було.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
