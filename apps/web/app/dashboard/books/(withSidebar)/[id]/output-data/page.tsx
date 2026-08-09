"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewRangeEditor } from "@/components/books/PreviewRangeEditor";
import { DistributionChannelPicker } from "@/components/books/DistributionChannelPicker";
import { KdpSelectPanel } from "@/components/books/KdpSelectPanel";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { parseRejectedConcerns } from "@/lib/rejectedBlocks";
import { cn } from "@/lib/utils";

const editSchema = z.object({
  title: z.string().min(3, "Назва має містити щонайменше 3 символи").max(255),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  genre: z.string().max(100).optional(),
  ageRating: z.string().optional(),
  language: z.string().length(2),
  priceEbook: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrint: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrintHardcover: z.coerce.number().positive().optional().or(z.literal("")),
  aiGenerated: z.boolean().optional(),
  aiGeneratedNote: z.string().max(1000).optional(),
});

type EditForm = z.infer<typeof editSchema>;

interface CoAuthor {
  name: string;
}

const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
];

const AGE_RATINGS = ["0+", "6+", "12+", "16+", "18+"];

interface MetadataBook {
  status: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  ageRating?: string | null;
  language: string;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  aiGenerated?: boolean;
  aiGeneratedNote?: string | null;
  coAuthors?: CoAuthor[] | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  epubUrl?: string | null;
  pageCount?: number | null;
  previewStart?: number | null;
  previewEnd?: number | null;
}

export default function OutputDataPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const { book, setBook, loading } = useBook<MetadataBook>(id);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");
  const [locallyFixed, setLocallyFixed] = useState(false);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [newCoAuthorName, setNewCoAuthorName] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const titleValue = watch("title") ?? "";
  const descValue = watch("description") ?? "";
  const aiGeneratedValue = watch("aiGenerated") ?? false;

  useEffect(() => {
    if (!book) return;
    setCoAuthors(Array.isArray(book.coAuthors) ? book.coAuthors : []);
    reset({
      title: book.title,
      subtitle: book.subtitle ?? "",
      description: book.description ?? "",
      genre: book.genre ?? "",
      ageRating: book.ageRating ?? "",
      language: book.language,
      priceEbook: book.priceEbook ? Number(book.priceEbook) : "",
      pricePrint: book.pricePrint ? Number(book.pricePrint) : "",
      pricePrintHardcover: book.pricePrintHardcover ? Number(book.pricePrintHardcover) : "",
      aiGenerated: book.aiGenerated ?? false,
      aiGeneratedNote: book.aiGeneratedNote ?? "",
    });
  }, [book, reset]);

  function addCoAuthor() {
    const name = newCoAuthorName.trim();
    if (!name) return;
    setCoAuthors((prev) => [...prev, { name }]);
    setNewCoAuthorName("");
  }

  function removeCoAuthor(index: number) {
    setCoAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  const onSubmit = async (data: EditForm) => {
    setServerError("");
    setSaved(false);
    try {
      const { book: updated } = await apiFetch<{ book: MetadataBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          subtitle: data.subtitle || null,
          description: data.description || null,
          genre: data.genre || null,
          ageRating: data.ageRating || null,
          language: data.language,
          priceEbook: data.priceEbook ? Number(data.priceEbook) : null,
          pricePrint: data.pricePrint ? Number(data.pricePrint) : null,
          pricePrintHardcover: data.pricePrintHardcover ? Number(data.pricePrintHardcover) : null,
          aiGenerated: data.aiGenerated ?? false,
          aiGeneratedNote: data.aiGenerated ? (data.aiGeneratedNote || null) : null,
          coAuthors: coAuthors.length > 0 ? coAuthors : null,
        }),
      });
      setBook(updated);
      setCoAuthors(Array.isArray(updated.coAuthors) ? updated.coAuthors : []);
      setSaved(true);
      setLocallyFixed(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setServerError(e.message || "Помилка збереження");
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const rejected = book ? parseRejectedConcerns(book) : { cover: false, manuscript: false, metadata: false };
  const showRejection = rejected.metadata && !locallyFixed;
  const titleInvalid = titleValue.length > 0 && titleValue.length < 3;

  return (
    <div className="p-8">
      <div className="space-y-6">
        <h1 className="text-lg font-semibold text-gray-900">Вихідні дані</h1>

        {showRejection && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            Модератор зазначив зауваження щодо метаданих: {book?.moderationNote}
          </div>
        )}

        <div className={cn("rounded-xl bg-white p-6 shadow-sm", showRejection || titleInvalid ? "border-2 border-red-400" : "border")}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="title">Назва *</Label>
                <span className={cn("text-xs", titleInvalid ? "text-red-500 font-medium" : "text-gray-400")}>
                  {titleValue.length}/255 {titleInvalid && "(мін. 3)"}
                </span>
              </div>
              <Input
                id="title"
                {...register("title")}
                className={cn(titleInvalid ? "border-red-400 focus-visible:ring-red-300" : "")}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subtitle">Підзаголовок</Label>
              <Input id="subtitle" {...register("subtitle")} placeholder="Наприклад: збірка оповідань" />
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
                    showRejection ? "border-red-400" : "border-input"
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
                <Label htmlFor="ageRating">Вікові обмеження</Label>
                <select
                  id="ageRating"
                  {...register("ageRating")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Не вказано</option>
                  {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Над книгою також працювали</Label>
                <div className="flex flex-wrap gap-1.5">
                  {coAuthors.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {c.name}
                      <button
                        type="button"
                        onClick={() => removeCoAuthor(i)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCoAuthorName}
                    onChange={(e) => setNewCoAuthorName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCoAuthor(); } }}
                    placeholder="Ім'я співавтора"
                    className="h-9 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCoAuthor}>
                    + Додати
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...register("aiGenerated")} className="rounded border-gray-300" />
                Текст (або обкладинку) частково/повністю створено за допомогою ШІ
              </label>
              {aiGeneratedValue && (
                <textarea
                  {...register("aiGeneratedNote")}
                  rows={2}
                  placeholder="Уточніть, що саме створено за допомогою ШІ (необов'язково)"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="pricePrint">Друк, м'яка (грн)</Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="pricePrintHardcover">Друк, тверда (грн)</Label>
                <Input
                  id="pricePrintHardcover"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("pricePrintHardcover")}
                  placeholder="299.99"
                />
                {errors.pricePrintHardcover && (
                  <p className="text-xs text-red-500">{errors.pricePrintHardcover.message}</p>
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

        {/* Distribution platforms */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-1">Платформи розповсюдження</h2>
          <p className="text-xs text-gray-500 mb-4">Оберіть, де продавати книгу. Можна вибрати кілька.</p>
          <DistributionChannelPicker bookId={id} />
        </div>

        {/* KDP Select management — only relevant once the book is live */}
        {book?.status === "PUBLISHED" && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <KdpSelectPanel bookId={id} bookStatus={book.status} />
          </div>
        )}

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
                setBook((b) => (b ? { ...b, previewStart: start, previewEnd: end } : b))
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
