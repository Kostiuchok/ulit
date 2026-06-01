"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../hooks/useApi";

interface Author {
  id: string;
  name: string;
  email: string;
  slug: string;
  avatarUrl?: string | null;
  contractAcceptedAt?: string | null;
  createdAt: string;
  _count: { books: number };
}

export default function AdminAuthorsPage() {
  const { apiFetch } = useApi();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<{ authors: Author[] }>("/api/admin/authors")
      .then((d) => setAuthors(d.authors))
      .finally(() => setLoading(false));
  }, []);

  const filtered = authors.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const withContract = authors.filter((a) => a.contractAcceptedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Автори</h1>
        <p className="text-sm text-gray-500 mt-1">
          {authors.length} авторів · {withContract} з підписаним договором
        </p>
      </div>

      <div className="flex gap-4">
        <input
          type="search"
          placeholder="Пошук автора…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-md border px-3 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
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
                          {new Date(author.contractAcceptedAt).toLocaleDateString("uk-UA")}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        ✕ Не підписано
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(author.createdAt).toLocaleDateString("uk-UA")}
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
