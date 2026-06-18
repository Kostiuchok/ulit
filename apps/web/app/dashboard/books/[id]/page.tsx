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
  title: z.string().min(3, "Назва має містити щонайменше 3 символи").max(255),
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

function StepRow({
  num,
  done,
  label,
  hint,
  action,
}: {
  num: number;
  done: boolean;
  label: string;
  hint?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-400"
        )}
      >
        {done ? "✓" : num}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", done ? "text-gray-700" : "text-gray-500")}>
          {label}
        </p>
        {hint && !done && (
          <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
        )}
      </div>
      {!done && action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="shrink-0">
            {action.label} →
          </Button>
        </Link>
      )}
    </div>
  );
}

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
  const [fixedBlocks, setFixedBlocks] = useState<Set<number>>(new Set());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const titleValue = watch("title") ?? "";
  const descValue = watch("description") ?? "";

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
      setFixedBlocks((prev) => { const s = new Set(prev); s.add(4); return s; });
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

  // Publication checklist conditions
  const hasManuscript = !!book?.originalDocxUrl;
  const hasConversion = !!book?.pdfUrl;
  const hasCover = !!book?.coverUrl;
  const hasMetadata = !!(book?.description && (book?.priceEbook || book?.pricePrint));
  const isProcessing = book?.status === "PROCESSING";
  const canPublish = hasManuscript && hasConversion && hasCover && !isProcessing;

  // Which blocks the admin flagged in the rejection note
  const rejectedBlocks = (() => {
    if (book?.moderationStatus !== "REJECTED" || !book?.moderationNote) return new Set<number>();
    const n = book.moderationNote.toLowerCase();
    const s = new Set<number>();
    if (/обкладин/.test(n)) s.add(1);
    if (/рукопис|docx|файл|конверт/.test(n)) s.add(2);
    if (/назв|опис|жанр|мов|ціна|price|isbn|метадан/.test(n)) s.add(4);
    return s;
  })();

  function blockCls(num: number, hasError = false) {
    const flagged = (rejectedBlocks.has(num) && !fixedBlocks.has(num)) || hasError;
    return cn("rounded-xl bg-white p-6 shadow-sm", flagged ? "border-2 border-red-400" : "border");
  }

  function stepCircle(num: number, done: boolean, hasError = false) {
    const flagged = (rejectedBlocks.has(num) && !fixedBlocks.has(num)) || hasError;
    return cn(
      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
      done && !flagged ? "bg-green-100 text-green-700"
        : flagged ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-500"
    );
  }

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
          {/* ── Rejection banner ── */}
          {book?.moderationStatus === "REJECTED" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-lg">✕</span>
                <p className="font-semibold text-red-800">Книгу відхилено модератором</p>
              </div>
              {book.moderationNote ? (
                <p className="text-sm text-red-700 whitespace-pre-wrap">{book.moderationNote}</p>
              ) : (
                <p className="text-sm text-red-600">Причину не вказано. Зверніться до підтримки.</p>
              )}
              <p className="text-xs text-red-500">
                Виправте зазначені недоліки та надішліть книгу на публікацію повторно.
              </p>
            </div>
          )}

          {/* ── STEP 1: Cover ── */}
          <div className={blockCls(1, !hasCover && book?.moderationStatus === "REJECTED")}>
            <div className="flex items-center gap-2 mb-4">
              <span className={stepCircle(1, hasCover, !hasCover && book?.moderationStatus === "REJECTED")}>
                {hasCover && !rejectedBlocks.has(1) ? "✓" : "1"}
              </span>
              <h2 className="text-base font-semibold">Обкладинка</h2>
            </div>
            <div className="flex items-center gap-4">
              {book?.coverUrl ? (
                <img
                  src={`${book.coverUrl.split("?")[0]}?t=${mountTime}`}
                  alt=""
                  className="h-36 w-28 rounded-md object-cover shadow"
                />
              ) : (
                <div className="flex h-36 w-28 items-center justify-center rounded-md bg-gray-100 text-4xl">
                  📖
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  {hasCover
                    ? "Обкладинку додано. Можна редагувати."
                    : "Створіть або завантажте обкладинку 1800×2700 px (2:3, 300 DPI)."}
                </p>
                <Link href={`/dashboard/books/${id}/cover`}>
                  <Button variant="outline" size="sm">
                    {hasCover ? "Редагувати обкладинку" : "Додати обкладинку →"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* ── STEP 2: Manuscript ── */}
          <div className={blockCls(2, !hasManuscript && book?.moderationStatus === "REJECTED")}>
            <div className="flex items-center gap-2 mb-4">
              <span className={stepCircle(2, hasManuscript, !hasManuscript && book?.moderationStatus === "REJECTED")}>
                {hasManuscript && !rejectedBlocks.has(2) ? "✓" : "2"}
              </span>
              <h2 className="text-base font-semibold">Рукопис (.docx)</h2>
            </div>
            <DocxUploader
              bookId={id}
              currentDocxUrl={book?.originalDocxUrl}
              onUploadSuccess={() => {
                setConversionActive(true);
                setBook((b: any) => b ? { ...b, status: "PROCESSING", originalDocxUrl: "uploaded", pdfUrl: null, pagesGeneratedAt: null } : b);
              }}
            />
          </div>

          {/* ── Conversion status (auto-shown during/after upload) ── */}
          <ConversionStatus
            bookId={id}
            active={conversionActive}
            onDone={(newStatus) => {
              setBook((b: any) => b ? { ...b, status: newStatus } : b);
            }}
          />

          {/* ── STEP 3: Preview ── */}
          {hasConversion && (
            <div className={blockCls(3)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={stepCircle(3, false)}>3</span>
                  <div>
                    <h2 className="text-base font-semibold">Перегляд книги</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Перевірте верстку, сторінки та обкладинку перед публікацією
                    </p>
                  </div>
                </div>
                <Link href={`/dashboard/books/${id}/preview`}>
                  <Button size="sm">
                    👁 Переглянути книгу
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ── STEP 4: Metadata ── */}
          <div className={blockCls(4, (titleValue.length > 0 && titleValue.length < 3))}>
            <div className="flex items-center gap-2 mb-5">
              <span className={stepCircle(4, hasMetadata, titleValue.length > 0 && titleValue.length < 3)}>
                {hasMetadata && !rejectedBlocks.has(4) && !(titleValue.length > 0 && titleValue.length < 3) ? "✓" : "4"}
              </span>
              <h2 className="text-base font-semibold">Метадані та ціни</h2>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Назва *</Label>
                  <span className={cn("text-xs", titleValue.length > 0 && titleValue.length < 3 ? "text-red-500 font-medium" : "text-gray-400")}>
                    {titleValue.length}/255 {titleValue.length > 0 && titleValue.length < 3 && "(мін. 3)"}
                  </span>
                </div>
                <Input
                  id="title"
                  {...register("title")}
                  className={cn(titleValue.length > 0 && titleValue.length < 3 ? "border-red-400 focus-visible:ring-red-300" : "")}
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Опис</Label>
                  <span className={cn("text-xs", descValue.length > 0 && descValue.length < 120 ? "text-amber-600 font-medium" : "text-gray-400")}>
                    {descValue.length}/5000 {descValue.length > 0 && descValue.length < 120 && `(рекомендовано мін. 120 для платформ)`}
                  </span>
                </div>
                <textarea
                  id="description"
                  {...register("description")}
                  rows={4}
                  className={cn(
                    "flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 resize-none",
                    descValue.length > 0 && descValue.length < 120
                      ? "border-amber-400 focus-visible:ring-amber-300"
                      : "border-input focus-visible:ring-ring"
                  )}
                  placeholder="Розкажіть читачам про вашу книгу… (рекомендовано від 120 символів)"
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
                  <Label htmlFor="language">
                    Мова книги *
                    <span className="ml-1.5 text-xs font-normal text-gray-400">(потрібна для Amazon, Google Play)</span>
                  </Label>
                  <select
                    id="language"
                    {...register("language")}
                    className={cn(
                      "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      rejectedBlocks.has(4) ? "border-red-400" : "border-input"
                    )}
                  >
                    <option value="uk">🇺🇦 Українська</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="pl">🇵🇱 Polski</option>
                    <option value="es">🇪🇸 Español</option>
                    <option value="it">🇮🇹 Italiano</option>
                    <option value="pt">🇵🇹 Português</option>
                    <option value="ru">Русский</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="priceEbook">Ціна е-книги (грн)</Label>
                  <Input
                    id="priceEbook"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("priceEbook")}
                    placeholder="49.99"
                  />
                  {errors.priceEbook && (
                    <p className="text-xs text-red-500">{errors.priceEbook.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricePrint">Ціна друку (грн)</Label>
                  <Input
                    id="pricePrint"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("pricePrint")}
                    placeholder="199.99"
                  />
                  {errors.pricePrint && (
                    <p className="text-xs text-red-500">{errors.pricePrint.message}</p>
                  )}
                </div>
              </div>

              {serverError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
              )}
              {saved && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
              )}

              <Button type="submit" loading={isSubmitting}>
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

          {/* Distribution */}
          <DistributionStatus bookId={id} bookStatus={book?.status ?? "DRAFT"} />

          {/* ── STEP 5: Publish ── */}
          {book?.status !== "PUBLISHED" && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  canPublish ? "bg-gray-100 text-gray-500" : "bg-gray-100 text-gray-300"
                )}>
                  5
                </span>
                <h2 className="text-base font-semibold">Публікація</h2>
              </div>

              {/* Checklist of what's missing */}
              {!canPublish && (
                <div className="mb-5 space-y-0 divide-y rounded-lg border bg-gray-50 px-4">
                  <StepRow
                    num={1}
                    done={hasManuscript}
                    label="Завантажено рукопис (.docx)"
                    hint="Перетягніть .docx файл у блок «Рукопис» вище"
                  />
                  <StepRow
                    num={2}
                    done={hasConversion}
                    label="Конвертацію завершено"
                    hint={isProcessing ? "Зачекайте завершення конвертації…" : "Буде автоматично після завантаження"}
                  />
                  <StepRow
                    num={3}
                    done={hasCover}
                    label="Додано обкладинку"
                    hint="Обкладинка потрібна для публікації в магазині"
                    action={{ label: "Редагувати", href: `/dashboard/books/${id}/cover` }}
                  />
                </div>
              )}

              {isProcessing ? (
                <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  Конвертація в процесі — кнопка публікації з'явиться автоматично
                </div>
              ) : (
                <PublishButton
                  bookId={id}
                  bookStatus={book?.status ?? "DRAFT"}
                  onPublished={() => setBook((b: any) => b ? { ...b, status: "PUBLISHED" } : b)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
