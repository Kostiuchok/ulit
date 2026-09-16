"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

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
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    setDeleteError(null);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setAuthors((prev) => prev.filter((a) => a.id !== id));
      setConfirmId(null);
    } catch (e: any) {
      // Requests here have been seen failing with a silent 401 (stale apiToken
      // embedded in the NextAuth session — re-login re-signs a fresh one), which
      // this used to swallow entirely: the row just stayed with no explanation.
      setDeleteError(
        e.code === "UNAUTHORIZED" || /401/.test(e.message || "")
          ? "Сесія застаріла. Вийдіть і увійдіть знову, потім спробуйте видалити ще раз."
          : e.message || "Помилка видалення автора"
      );
    } finally {
      setDeletingId(null);
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
        <Input
          type="search"
          placeholder="Пошук автора…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />
        <Select value={contractFilter} onValueChange={(v) => setContractFilter(v as ContractFilter)}>
          <SelectTrigger className="h-9 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі договори</SelectItem>
            <SelectItem value="signed">Підписаний</SelectItem>
            <SelectItem value="unsigned">Не підписаний</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Завантаження…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Авторів не знайдено</div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Автор</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Email</TableHead>
                <TableHead className="h-auto px-4 py-3 text-center font-semibold text-gray-600">Книги</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Договір</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Зареєстрований</TableHead>
                <TableHead className="h-auto px-4 py-3 font-semibold text-gray-600">Остання активність</TableHead>
                <TableHead className="h-auto px-4 py-3 text-right font-semibold text-gray-600">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((author) => (
                <TableRow key={author.id}>
                  <TableCell className="px-4 py-3">
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
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{author.email}</TableCell>
                  <TableCell className="px-4 py-3 text-center font-semibold text-gray-900">
                    {author._count.books}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {author.contractAcceptedAt ? (
                      <div>
                        <Badge className="rounded-full border-transparent bg-green-100 font-medium text-green-700 hover:bg-green-100">
                          ✓ Підписано
                        </Badge>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(author.contractAcceptedAt)}
                        </p>
                      </div>
                    ) : (
                      <Badge className="rounded-full border-transparent bg-red-100 font-medium text-red-700 hover:bg-red-100">
                        ✕ Не підписано
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(author.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(author.lastBookAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
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
                          <Button size="sm" variant="outline" onClick={() => { setConfirmId(null); setDeleteError(null); }}>
                            Скасувати
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => { setConfirmId(author.id); setDeleteError(null); }}
                        >
                          Видалити
                        </Button>
                      )}
                    </div>
                    {confirmId === author.id && deleteError && (
                      <p className="mt-1.5 text-xs text-red-600">{deleteError}</p>
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
