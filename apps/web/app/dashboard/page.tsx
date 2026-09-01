"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useApi } from "../../hooks/useApi";

interface DashboardBook {
  id: string;
  status: string;
  moderationStatus: string;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
}

interface StatSource {
  source: string;
  revenue: number;
  count: number;
}

interface AuthorStat {
  unitsSoldSite: number;
  sources: StatSource[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<DashboardBook[] | null>(null);
  const [stats, setStats] = useState<AuthorStat[] | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: DashboardBook[] }>("/api/books")
      .then(({ books }) => setBooks(books))
      .catch(() => setBooks([]));
    apiFetch<{ stats: AuthorStat[] }>("/api/authors/me/stats")
      .then(({ stats }) => setStats(stats))
      .catch(() => setStats([]));
  }, [token]);

  const loading = books === null || stats === null;

  const totalBooks = books?.length ?? 0;
  const published = books?.filter((b) => b.status === "PUBLISHED").length ?? 0;
  const pendingReview = books?.filter((b) => b.status === "REVIEW").length ?? 0;
  const distributedExternally =
    books?.filter(
      (b) => b.d2dStatus === "PUBLISHED" || b.kdpStatus === "PUBLISHED" || b.googleStatus === "PUBLISHED"
    ).length ?? 0;
  const rejected = books?.filter((b) => b.moderationStatus === "REJECTED").length ?? 0;

  const unitsSold = stats?.reduce((sum, s) => sum + s.unitsSoldSite, 0) ?? 0;
  const royaltyTotal = stats?.reduce(
    (sum, s) => sum + s.sources.reduce((sSum, src) => sSum + src.revenue, 0),
    0
  ) ?? 0;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">
          Вітаємо, {session?.user?.name}!
        </h1>
        <p className="mt-1 text-gray-500">Ваш кабінет автора на платформі ULIT.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Книги" value={totalBooks} loading={loading} href="/dashboard/books" />
          <StatTile label="Продажі" value={unitsSold} loading={loading} />
          <StatTile label="Роялті (грн)" value={royaltyTotal.toFixed(2)} loading={loading} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatTile
            label="Опубліковано"
            value={published}
            loading={loading}
            href="/dashboard/books?filter=published"
          />
          <StatTile
            label="На затвердженні адміном"
            value={pendingReview}
            loading={loading}
            href="/dashboard/books?filter=pending"
          />
          <StatTile
            label="На сторонніх сервісах"
            value={distributedExternally}
            loading={loading}
            href="/dashboard/books?filter=distributed"
          />
          <StatTile
            label="Повернуто на доопрацювання"
            value={rejected}
            loading={loading}
            href="/dashboard/books?filter=rejected"
          />
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/dashboard/books/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Нова книга
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Профіль
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  loading,
  href,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border bg-white p-6 shadow-sm h-full transition hover:shadow-md hover:border-gray-300">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">
        {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-100" /> : value}
      </p>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
