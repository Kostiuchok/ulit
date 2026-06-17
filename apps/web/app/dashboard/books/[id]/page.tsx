"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { useApi } from "../../../../hooks/useApi";
import { cn } from "../../../../lib/utils";
import { DocxUploader } from "../../../../components/dashboard/DocxUploader";
import { ConversionStatus } from "../../../../components/dashboard/ConversionStatus";
import { DistributionStatus } from "../../../../components/books/DistributionStatus";
import { PublishButton } from "../../../../components/books/PublishButton";
import { PreviewRangeEditor } from "../../../../components/books/PreviewRangeEditor";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Чернетка", className: "bg-gray-100 text-gray-600" },
  PROCESSING: { label: "Обробка", className: "bg-blue-100 text-blue-700" },
  REVIEW: { label: "На перевірці", className: "bg-yellow-100 text-yellow-700" },
  PUBLISHED: { label: "Опубліковано", className: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "Архів", className: "bg-gray-100 text-gray-500" },
};

const editSchema = z.object({
  title: z.string().min(1, "Назва обов'язкова").max(255),
  description: z.string().max(5000).optional(),
  genre: z.string().max(100).optional(),
  language: z.string().length(2),
  priceEbook: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrint: z.coerce.number().positive().optional().or(z.literal("")),
});

type EditForm = z.infer<typeof editSchema>;

const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
];

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch, token } = useApi();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");
  const [conversionActive, setConversionActive] = useState(false);
  const [mountTime] = useState(() => Date.now());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: any }>(`/api/books/${id}`)
      .then(({ book }) => {
        setBook(book);
        if (book.status === "PROCESSING") setConversionActive(true);
        reset({
          title: book.title,
          description: book.description ?? "",
          genre: book.genre ?? "",
          language: book.language,
          priceEbook: book.priceEbook ? Number(book.priceEbook) : "",
          pricePrint: book.pricePrint ? Number(book.pricePrint) : "",
        });
      })
      .catch(() => router.push("/dashboard/books"))
      .finally(() => setLoading(false));
  }, [token, id]);

  const onSubmit = async (data: EditForm) => {
    setServerError("");
    setSaved(false);
    try {
      const { book: updated } = await apiFetch<{ book: any }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          genre: data.genre || null,
          language: data.language,
          priceEbook: data.priceEbook ? Number(data.priceEbook) : null,
          pricePrint: data.pricePrint ? Number(data.pricePrint) : null,
        }),
      });
      setBook(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setServerError(e.message || "Помилка збереження");
    }
  };

  async function handleDelete() {
    if (!confirm("Видалити книгу? Цю дію не можна скасувати.")) return;
    try {
      await apiFetch(`/api/books/${id}`, { method: "DELETE" });
      router.push("/dashboard/books");
    } catch (e: any) {
      alert(e.message || "Помилка видалення");
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-6" />
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const status = STATUS_LABELS[book?.status] ?? STATUS_LABELS.DRAFT;

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/books" className="text-sm text-gray-500 hover:text-gray-700">
              ← Мої книги
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-900 truncate max-w-xs">{book?.title}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>
              {status.label}
            </span>
          </div>
          {book?.status !== "PUBLISHED" && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Видалити
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {/* Cover placeholder */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4">Обкладинка</h2>
            <div className="flex items-center gap-4">
              {book?.coverUrl ? (
                <img src={`${book.coverUrl.split("?")[0]}?t=${mountTime}`} alt="" className="h-36 w-28 rounded-md object-cover" />
              ) : (
                <div className="flex h-36 w-28 items-center justify-center rounded-md bg-gray-100 text-4xl">
                  📖
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Створіть або завантажте обкладинку 1800×2700 px (2:3, 300 DPI).
                </p>
                <Link href={`/dashboard/books/${id}/cover`}>
                  <Button variant="outline" size="sm">
                    Редагувати обкладинку
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Preview button — shown when PDF ready */}
          {book?.pdfUrl && (
            <div className="rounded-xl border bg-white p-6 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Перегляд книги</h2>
                <p className="text-xs text-gray-500 mt-0.5">Перегляньте як виглядатимуть сторінки</p>
              </div>
              <Link href={`/dashboard/books/${id}/preview`}>
                <Button variant="outline" size="sm">
                  👁 Переглянути
                </Button>
              </Link>
            </div>
          )}

          {/* DOCX upload */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4">Файл рукопису (.docx)</h2>
            <DocxUploader
              bookId={id}
              currentDocxUrl={book?.originalDocxUrl}
              onUploadSuccess={() => {
                setConversionActive(true);
                setBook((b: any) => b ? { ...b, status: "PROCESSING", originalDocxUrl: "uploaded" } : b);
              }}
            />
          </div>

          {/* Conversion status */}
          <ConversionStatus bookId={id} active={conversionActive} />

          {/* Distribution */}
          <DistributionStatus bookId={id} bookStatus={book?.status ?? "DRAFT"} />

          {/* Metadata form */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-5">Метадані</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Назва *</Label>
                <Input id="title" {...register("title")} />
                {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Опис</Label>
                <textarea
                  id="description"
                  {...register("description")}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="genre">Жанр</Label>
                  <select
                    id="genre"
                    {...register("genre")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Оберіть жанр</option>
                    {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="language">Мова</Label>
                  <select
                    id="language"
                    {...register("language")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="uk">Українська</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="pl">Polski</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="priceEbook">Ціна е-книги (грн)</Label>
                  <Input id="priceEbook" type="number" step="0.01" min="0" {...register("priceEbook")} placeholder="49.99" />
                  {errors.priceEbook && <p className="text-xs text-red-500">{errors.priceEbook.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricePrint">Ціна друку (грн)</Label>
                  <Input id="pricePrint" type="number" step="0.01" min="0" {...register("pricePrint")} placeholder="199.99" />
                  {errors.pricePrint && <p className="text-xs text-red-500">{errors.pricePrint.message}</p>}
                </div>
              </div>

              {serverError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
              )}
              {saved && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
              )}

              <Button type="submit" loading={isSubmitting} disabled={book?.status === "PUBLISHED"}>
                Зберегти зміни
              </Button>
            </form>
          </div>

          {/* Preview excerpt — only for books with EPUB */}
          {book?.epubUrl && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold mb-1">Уривок для читачів</h2>
              <p className="text-xs text-gray-500 mb-4">
                Встановіть діапазон сторінок, які покупці зможуть прочитати безкоштовно.
              </p>
              <PreviewRangeEditor
                bookId={id}
                pageCount={book?.pageCount}
                initialStart={book?.previewStart}
                initialEnd={book?.previewEnd}
                onSaved={(start, end) =>
                  setBook((b: any) => b ? { ...b, previewStart: start, previewEnd: end } : b)
                }
              />
            </div>
          )}

          {/* Publish */}
          {book?.status !== "PUBLISHED" && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold mb-4">Публікація</h2>
              <PublishButton
                bookId={id}
                bookStatus={book?.status ?? "DRAFT"}
                onPublished={() => setBook((b: any) => b ? { ...b, status: "PUBLISHED" } : b)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
