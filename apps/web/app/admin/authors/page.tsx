"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";
import { Button } from "../../../components/ui/button";

interface Author {
  id: string;
  name: string;
  email: string;
  slug: string;
  avatarUrl?: string | null;
  contractAcceptedAt?: string | null;
  createdAt: string;
  lastBookAt?: string | null;
  _count: { books: number };
}

type ContractFilter = "all" | "signed" | "unsigned";

export default function AdminAuthorsPage() {
  const { apiFetch, token } = useApi();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] = useState<ContractFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = contractFilter !== "all" ? `?contract=${contractFilter}` : "";
    apiFetch<{ authors: Author[] }>(`/api/admin/authors${params}`)
      .then((d) => setAuthors(d.authors))
      .finally(() => setLoading(false));
  }, [token, contractFilter]);

  const filtered = authors.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const withContract = authors.filter((a) => a.contractAcceptedAt).length;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setAuthors((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  function formatDate(iso?: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Автори</h1>
        <p className="text-sm text-gray-500 mt-1">
          {authors.length} авторів · {withContract} з підписаним договором
        </p>
      </div>

      <div className="flex gap-3">
        <input
          type="search"
          placeholder="Пошук автора…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-md border px-3 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <select
          value={contractFilter}
          onChange={(e) => setContractFilter(e.target.value as ContractFilter)}
          className="h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="all">Всі договори</option>
          <option value="signed">Підписаний</option>
          <option value="unsigned">Не підписаний</option>
        </select>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Завантаження…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Авторів не знайдено</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Автор</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Книги</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Договір</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Зареєстрований</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Остання активність</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((author) => (
                <tr key={author.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {author.avatarUrl ? (
                        <img src={author.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0">👤</div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{author.name}</p>
                        <p className="text-xs text-gray-400">/{author.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{author.email}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">
                    {author._count.books}
                  </td>
                  <td className="px-4 py-3">
                    {author.contractAcceptedAt ? (
                      <div>
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          ✓ Підписано
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(author.contractAcceptedAt)}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        ✕ Не підписано
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(author.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(author.lastBookAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/authors/${author.id}`}>
                        <Button size="sm" variant="outline">Деталі</Button>
                      </Link>
                      {confirmId === author.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            loading={deletingId === author.id}
                            onClick={() => handleDelete(author.id)}
                          >
                            Підтвердити
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                            Скасувати
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => setConfirmId(author.id)}
                        >
                          Видалити
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
