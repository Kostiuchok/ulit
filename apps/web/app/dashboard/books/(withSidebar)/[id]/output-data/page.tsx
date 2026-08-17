"use client";

import { useEffect, useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewRangeEditor } from "@/components/books/PreviewRangeEditor";
import { DistributionChannelPicker } from "@/components/books/DistributionChannelPicker";
import { KdpSelectPanel } from "@/components/books/KdpSelectPanel";
import { StepIndicator } from "@/components/books/StepIndicator";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { DISTRIBUTION_PLATFORMS } from "@/lib/distributionPlatforms";
import { parseRejectedConcerns } from "@/lib/rejectedBlocks";
import { cn } from "@/lib/utils";

// T-2060 п.1/п.3 -- confirmed by live Ridero test (2026-08-17), matches
// apps/api/src/modules/books/publish.ts's DESCRIPTION_MIN_LENGTH/MAX_LENGTH.
const DESCRIPTION_MIN_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;

const infoSchema = z.object({
  title: z.string().min(3, "Назва має містити щонайменше 3 символи").max(255),
  subtitle: z.string().max(255).optional(),
  description: z
    .string()
    .min(DESCRIPTION_MIN_LENGTH, `Анотація має містити щонайменше ${DESCRIPTION_MIN_LENGTH} символів`)
    .max(DESCRIPTION_MAX_LENGTH, `Анотація має містити не більше ${DESCRIPTION_MAX_LENGTH} символів`),
  genre: z.string().max(100).optional(),
  ageRating: z.string().min(1, "Вкажіть вікові обмеження"),
  language: z.string().length(2),
  aiGenerated: z.boolean().optional(),
  aiGeneratedNote: z.string().max(1000).optional(),
});
type InfoForm = z.infer<typeof infoSchema>;

const priceSchema = z.object({
  priceEbook: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrint: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrintHardcover: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrintBw: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrintHardcoverBw: z.coerce.number().positive().optional().or(z.literal("")),
});
type PriceForm = z.infer<typeof priceSchema>;

type PrintCost =
  | { status: "DONE"; softcoverCost: number; hardcoverCost: number }
  | { status: "NO_PAGE_COUNT" }
  | { status: "NO_SETTINGS" };

function PrintCostHint({
  cost,
  field,
  price,
}: {
  cost: PrintCost | null;
  field: "softcoverCost" | "hardcoverCost";
  price?: string | number;
}) {
  if (cost?.status === "DONE") {
    const priceNum = Number(price);
    const profit = Number.isFinite(priceNum) && priceNum > 0 ? priceNum - cost[field] : null;
    return (
      <div className="space-y-0.5">
        <p className="text-xs text-gray-400">Собівартість виготовлення: ~{cost[field].toFixed(2)} грн</p>
        {profit !== null && (
          <p className={cn("text-xs font-medium", profit < 0 ? "text-red-500" : "text-green-600")}>
            {profit < 0
              ? `Ціна нижча за собівартість на ${Math.abs(profit).toFixed(2)} грн`
              : `Заробите: ~${profit.toFixed(2)} грн`}
          </p>
        )}
      </div>
    );
  }
  if (cost?.status === "NO_SETTINGS") {
    return <p className="text-xs text-gray-400">Собівартість друку ще не налаштована адміном</p>;
  }
  return <p className="text-xs text-gray-400">Завантажте рукопис, щоб побачити собівартість</p>;
}

interface CoAuthor {
  name: string;
}

// T-2060 п.4 — structured per-book authors, independent of the account profile.
interface BookAuthor {
  lastName: string;
  firstName: string;
  middleName?: string;
  photoUrl?: string;
}

// T-2060 п.5 — "Над книгою працювали", separate entity from bookAuthors.
interface Contributor {
  role: string;
  name: string;
}

const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
];

const AGE_RATINGS = ["0+", "0-6", "6-10", "11-14", "15-17", "18+"];

const STEP_META = [
  { label: "Інформація" },
  { label: "Файл" },
  { label: "Ціна" },
  { label: "Розповсюдження" },
  { label: "Огляд" },
];

interface MetadataBook {
  status: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  ageRating?: string | null;
  language: string;
  coverUrl?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  aiGenerated?: boolean;
  aiGeneratedNote?: string | null;
  coAuthors?: CoAuthor[] | null;
  bookAuthors?: BookAuthor[] | null;
  contributors?: Contributor[] | null;
  authorBio?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  epubUrl?: string | null;
  pageCount?: number | null;
  previewStart?: number | null;
  previewEnd?: number | null;
  originalDocxUrl?: string | null;
  distributionChannels?: string[] | null;
}

// docs/isbn-udc-requirements.md, "Детальний технічний чекліст оформлення ISBN" (2026-08-17).
// Орієнтовно "пів сторінки" ≈ 900-1000 знаків -- м'якший поріг, ніж наша сувора верхня межа
// анотації (500, T-2060), тому це окрема (не блокуюча) перевірка, не заміна existing validation.
const ISBN_ANNOTATION_HALF_PAGE_CHARS = 1000;

interface IsbnChecklistItem {
  label: string;
  done: boolean;
  hint?: string;
}

function IsbnReadinessChecklist({ book, bookAuthors }: { book: MetadataBook | null; bookAuthors: BookAuthor[] }) {
  const hasAuthorName = bookAuthors.some((a) => a.lastName.trim() && a.firstName.trim());
  const descLength = (book?.description ?? "").length;
  const annotationOk = descLength > 0 && descLength <= ISBN_ANNOTATION_HALF_PAGE_CHARS;

  const items: IsbnChecklistItem[] = [
    {
      label: "Анотація (файл 1 для ISBN-служби) — не більше пів сторінки",
      done: annotationOk,
      hint: !annotationOk && descLength > 0 ? `${descLength} символів — орієнтовно більше пів сторінки` : undefined,
    },
    {
      label: "Повне ПІБ автора (файл 1 для ISBN-служби)",
      done: hasAuthorName,
      hint: !hasAuthorName ? "Додайте прізвище та ім'я автора вище, у розділі «Автори книги»" : undefined,
    },
    { label: "Обкладинка завантажена", done: !!book?.coverUrl },
  ];

  return (
    <div className="rounded-xl border bg-white p-5 space-y-3 text-sm">
      <div>
        <h2 className="text-base font-semibold">Готовність до оформлення ISBN</h2>
        <p className="text-xs text-gray-500">
          Перевірка інформації, яку потрібно надати службі присвоєння ISBN — детальніше в{" "}
          <code className="text-xs">docs/isbn-udc-requirements.md</code>.
        </p>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2">
            <span className={cn("mt-0.5", it.done ? "text-green-600" : "text-amber-500")}>
              {it.done ? "✓" : "○"}
            </span>
            <span className={it.done ? "text-gray-700" : "text-gray-500"}>
              {it.label}
              {it.hint && <span className="block text-xs text-amber-600">{it.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-400 border-t pt-2">
        Структуру друкованого файлу (титул → порожня сторінка → текст, файл 2 для ISBN-служби) платформа
        сформує автоматично при генерації друкованого макету — окремої дії від автора поки не потребує.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function OutputDataContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiFetch } = useApi();
  const { book, setBook, loading } = useBook<MetadataBook>(id);
  const requestedStep = Number(searchParams.get("step"));
  const initialStep = Number.isInteger(requestedStep) && requestedStep >= 0 && requestedStep < STEP_META.length
    ? requestedStep
    : 0;
  const [step, setStep] = useState(initialStep);

  const [infoSaved, setInfoSaved] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [locallyFixed, setLocallyFixed] = useState(false);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [newCoAuthorName, setNewCoAuthorName] = useState("");
  const [bookAuthors, setBookAuthors] = useState<BookAuthor[]>([]);
  const [newAuthor, setNewAuthor] = useState<BookAuthor>({ lastName: "", firstName: "", middleName: "", photoUrl: "" });
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [newContributor, setNewContributor] = useState<Contributor>({ role: "", name: "" });
  const [authorBio, setAuthorBio] = useState("");

  const [priceSaved, setPriceSaved] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [printCost, setPrintCost] = useState<PrintCost | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<PrintCost>(`/api/books/${id}/print-cost`).then(setPrintCost).catch(() => {});
  }, [id]);

  const infoForm = useForm<InfoForm>({ resolver: zodResolver(infoSchema) });
  const priceForm = useForm<PriceForm>({ resolver: zodResolver(priceSchema) });

  const titleValue = infoForm.watch("title") ?? "";
  const descValue = infoForm.watch("description") ?? "";
  const aiGeneratedValue = infoForm.watch("aiGenerated") ?? false;

  useEffect(() => {
    if (!book) return;
    setCoAuthors(Array.isArray(book.coAuthors) ? book.coAuthors : []);
    setBookAuthors(Array.isArray(book.bookAuthors) ? book.bookAuthors : []);
    setContributors(Array.isArray(book.contributors) ? book.contributors : []);
    setAuthorBio(book.authorBio ?? "");
    infoForm.reset({
      title: book.title,
      subtitle: book.subtitle ?? "",
      description: book.description ?? "",
      genre: book.genre ?? "",
      ageRating: book.ageRating ?? "",
      language: book.language,
      aiGenerated: book.aiGenerated ?? false,
      aiGeneratedNote: book.aiGeneratedNote ?? "",
    });
    priceForm.reset({
      priceEbook: book.priceEbook ? Number(book.priceEbook) : "",
      pricePrint: book.pricePrint ? Number(book.pricePrint) : "",
      pricePrintHardcover: book.pricePrintHardcover ? Number(book.pricePrintHardcover) : "",
      pricePrintBw: book.pricePrintBw ? Number(book.pricePrintBw) : "",
      pricePrintHardcoverBw: book.pricePrintHardcoverBw ? Number(book.pricePrintHardcoverBw) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  function addCoAuthor() {
    const name = newCoAuthorName.trim();
    if (!name) return;
    setCoAuthors((prev) => [...prev, { name }]);
    setNewCoAuthorName("");
  }

  function addBookAuthor() {
    if (!newAuthor.lastName.trim() || !newAuthor.firstName.trim()) return;
    setBookAuthors((prev) => [...prev, {
      lastName: newAuthor.lastName.trim(),
      firstName: newAuthor.firstName.trim(),
      middleName: newAuthor.middleName?.trim() || undefined,
      photoUrl: newAuthor.photoUrl?.trim() || undefined,
    }]);
    setNewAuthor({ lastName: "", firstName: "", middleName: "", photoUrl: "" });
  }

  function removeBookAuthor(index: number) {
    setBookAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  function addContributor() {
    if (!newContributor.role.trim() || !newContributor.name.trim()) return;
    setContributors((prev) => [...prev, { role: newContributor.role.trim(), name: newContributor.name.trim() }]);
    setNewContributor({ role: "", name: "" });
  }

  function removeContributor(index: number) {
    setContributors((prev) => prev.filter((_, i) => i !== index));
  }

  function removeCoAuthor(index: number) {
    setCoAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  const onSubmitInfo = async (data: InfoForm) => {
    setInfoError("");
    setInfoSaved(false);
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
          aiGenerated: data.aiGenerated ?? false,
          aiGeneratedNote: data.aiGenerated ? (data.aiGeneratedNote || null) : null,
          coAuthors: coAuthors.length > 0 ? coAuthors : null,
          bookAuthors: bookAuthors.length > 0 ? bookAuthors : null,
          contributors: contributors.length > 0 ? contributors : null,
          authorBio: authorBio.trim() || null,
        }),
      });
      setBook(updated);
      setCoAuthors(Array.isArray(updated.coAuthors) ? updated.coAuthors : []);
      setBookAuthors(Array.isArray(updated.bookAuthors) ? updated.bookAuthors : []);
      setContributors(Array.isArray(updated.contributors) ? updated.contributors : []);
      setAuthorBio(updated.authorBio ?? "");
      setInfoSaved(true);
      setLocallyFixed(true);
      setTimeout(() => setInfoSaved(false), 3000);
    } catch (e: any) {
      setInfoError(e.message || "Помилка збереження");
    }
  };

  const onSubmitPrice = async (data: PriceForm) => {
    setPriceError("");
    setPriceSaved(false);
    try {
      const { book: updated } = await apiFetch<{ book: MetadataBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          priceEbook: data.priceEbook ? Number(data.priceEbook) : null,
          pricePrint: data.pricePrint ? Number(data.pricePrint) : null,
          pricePrintHardcover: data.pricePrintHardcover ? Number(data.pricePrintHardcover) : null,
          pricePrintBw: data.pricePrintBw ? Number(data.pricePrintBw) : null,
          pricePrintHardcoverBw: data.pricePrintHardcoverBw ? Number(data.pricePrintHardcoverBw) : null,
        }),
      });
      setBook(updated);
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 3000);
    } catch (e: any) {
      setPriceError(e.message || "Помилка збереження");
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
      <div className="max-w-3xl space-y-6">
        <h1 className="text-lg font-semibold text-gray-900">Вихідні дані</h1>

        {showRejection && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            Модератор зазначив зауваження щодо метаданих: {book?.moderationNote}
          </div>
        )}

        <StepIndicator steps={STEP_META} current={step} onStepClick={setStep} />

        {step === 0 && (
          <div className={cn("rounded-xl bg-white p-6 shadow-sm", showRejection || titleInvalid ? "border-2 border-red-400" : "border")}>
            <form onSubmit={infoForm.handleSubmit(onSubmitInfo)} className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Назва *</Label>
                  <span className={cn("text-xs", titleInvalid ? "text-red-500 font-medium" : "text-gray-400")}>
                    {titleValue.length}/255 {titleInvalid && "(мін. 3)"}
                  </span>
                </div>
                <Input
                  id="title"
                  {...infoForm.register("title")}
                  className={cn(titleInvalid ? "border-red-400 focus-visible:ring-red-300" : "")}
                />
                {infoForm.formState.errors.title && (
                  <p className="text-sm text-red-500">{infoForm.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subtitle">Підзаголовок</Label>
                <Input id="subtitle" {...infoForm.register("subtitle")} placeholder="Наприклад: збірка оповідань" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Анотація *</Label>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      descValue.length > 0 && (descValue.length < DESCRIPTION_MIN_LENGTH || descValue.length > DESCRIPTION_MAX_LENGTH)
                        ? "text-red-500"
                        : "text-gray-400"
                    )}
                  >
                    {descValue.length}/{DESCRIPTION_MAX_LENGTH} (від {DESCRIPTION_MIN_LENGTH} до {DESCRIPTION_MAX_LENGTH})
                  </span>
                </div>
                <textarea
                  id="description"
                  {...infoForm.register("description")}
                  rows={4}
                  className={cn(
                    "flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 resize-none",
                    infoForm.formState.errors.description
                      ? "border-red-400 focus-visible:ring-red-300"
                      : "border-input focus-visible:ring-ring"
                  )}
                  placeholder={`Розкажіть читачам про вашу книгу… (від ${DESCRIPTION_MIN_LENGTH} до ${DESCRIPTION_MAX_LENGTH} символів)`}
                />
                {infoForm.formState.errors.description && (
                  <p className="text-sm text-red-500">{infoForm.formState.errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="genre">Жанр</Label>
                  <select
                    id="genre"
                    {...infoForm.register("genre")}
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
                    {...infoForm.register("language")}
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
                  <Label htmlFor="ageRating">Вікові обмеження *</Label>
                  <select
                    id="ageRating"
                    {...infoForm.register("ageRating")}
                    className={cn(
                      "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2",
                      infoForm.formState.errors.ageRating
                        ? "border-red-400 focus-visible:ring-red-300"
                        : "border-input focus-visible:ring-ring"
                    )}
                  >
                    <option value="">Оберіть вікове обмеження</option>
                    {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {infoForm.formState.errors.ageRating && (
                    <p className="text-sm text-red-500">{infoForm.formState.errors.ageRating.message}</p>
                  )}
                </div>
              </div>

              {/* T-2060 п.4 — структуровані автори книги, незалежно від профілю користувача */}
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Автори книги</Label>
                <p className="text-xs text-gray-400">
                  Якщо авторів декілька — кожен додає власне прізвище/ім&apos;я і, за бажанням, своє фото.
                </p>
                {bookAuthors.length > 0 && (
                  <div className="space-y-1.5">
                    {bookAuthors.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-sm">
                        {a.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                        )}
                        <span className="flex-1">
                          {a.lastName} {a.firstName} {a.middleName || ""}
                        </span>
                        <button type="button" onClick={() => removeBookAuthor(i)} className="text-gray-400 hover:text-red-600">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input
                    value={newAuthor.lastName}
                    onChange={(e) => setNewAuthor((p) => ({ ...p, lastName: e.target.value }))}
                    placeholder="Прізвище"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={newAuthor.firstName}
                    onChange={(e) => setNewAuthor((p) => ({ ...p, firstName: e.target.value }))}
                    placeholder="Ім'я"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={newAuthor.middleName}
                    onChange={(e) => setNewAuthor((p) => ({ ...p, middleName: e.target.value }))}
                    placeholder="По батькові"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={newAuthor.photoUrl}
                    onChange={(e) => setNewAuthor((p) => ({ ...p, photoUrl: e.target.value }))}
                    placeholder="URL фото (необов'язково)"
                    className="h-9 text-sm"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addBookAuthor}>+ Додати автора</Button>
              </div>

              {/* T-2060 п.5 — окрема сутність, не змішана з авторами */}
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Над книгою працювали</Label>
                <p className="text-xs text-gray-400">Редактор, ілюстратор, дизайнер обкладинки тощо.</p>
                {contributors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {contributors.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                        {c.role}: {c.name}
                        <button type="button" onClick={() => removeContributor(i)} className="text-gray-400 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={newContributor.role}
                    onChange={(e) => setNewContributor((p) => ({ ...p, role: e.target.value }))}
                    placeholder="Роль (напр. редактор)"
                    className="h-9 w-40 shrink-0 text-sm"
                  />
                  <Input
                    value={newContributor.name}
                    onChange={(e) => setNewContributor((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addContributor(); } }}
                    placeholder="Ім'я"
                    className="h-9 flex-1 min-w-0 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addContributor} className="shrink-0">+ Додати</Button>
                </div>
              </div>

              {/* T-2060 п.6 — канонічне джерело тексту біографії; показується й редагується вживу на обкладинці */}
              <div className="space-y-1.5">
                <Label htmlFor="authorBio">Біографія автора</Label>
                <textarea
                  id="authorBio"
                  value={authorBio}
                  onChange={(e) => setAuthorBio(e.target.value)}
                  rows={3}
                  placeholder="Наприклад: Валентина Островська народилась у…"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" {...infoForm.register("aiGenerated")} className="rounded border-gray-300" />
                  Текст (або обкладинку) частково/повністю створено за допомогою ШІ
                </label>
                {aiGeneratedValue && (
                  <textarea
                    {...infoForm.register("aiGeneratedNote")}
                    rows={2}
                    placeholder="Уточніть, що саме створено за допомогою ШІ (необов'язково)"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                )}
              </div>

              {infoError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{infoError}</div>
              )}
              {infoSaved && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
              )}

              <Button type="submit" loading={infoForm.formState.isSubmitting}>
                Зберегти зміни
              </Button>
            </form>
          </div>
        )}

        {step === 1 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Рукопис (.docx)</h2>
              <p className="text-xs text-gray-500">Завантажте файл або замініть уже завантажений.</p>
            </div>
            <DocxUploader
              bookId={id}
              currentDocxUrl={book?.originalDocxUrl}
              onUploadSuccess={() => setBook((b) => (b ? { ...b, originalDocxUrl: "uploaded" } : b))}
            />
            <Link
              href={`/dashboard/books/${id}/manuscript`}
              className="inline-block text-sm text-black underline hover:no-underline"
            >
              Редагувати текст рукопису →
            </Link>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <form onSubmit={priceForm.handleSubmit(onSubmitPrice)} className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="priceEbook">Ціна е-книги (грн)</Label>
                  <Input
                    id="priceEbook"
                    type="number"
                    step="0.01"
                    min="0"
                    {...priceForm.register("priceEbook")}
                    placeholder="49.99"
                  />
                  {priceForm.formState.errors.priceEbook && (
                    <p className="text-xs text-red-500">{priceForm.formState.errors.priceEbook.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricePrint">Друк, м&apos;яка (грн)</Label>
                  <Input
                    id="pricePrint"
                    type="number"
                    step="0.01"
                    min="0"
                    {...priceForm.register("pricePrint")}
                    placeholder="199.99"
                  />
                  {priceForm.formState.errors.pricePrint && (
                    <p className="text-xs text-red-500">{priceForm.formState.errors.pricePrint.message}</p>
                  )}
                  <PrintCostHint cost={printCost} field="softcoverCost" price={priceForm.watch("pricePrint")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricePrintHardcover">Друк, тверда (грн)</Label>
                  <Input
                    id="pricePrintHardcover"
                    type="number"
                    step="0.01"
                    min="0"
                    {...priceForm.register("pricePrintHardcover")}
                    placeholder="299.99"
                  />
                  {priceForm.formState.errors.pricePrintHardcover && (
                    <p className="text-xs text-red-500">{priceForm.formState.errors.pricePrintHardcover.message}</p>
                  )}
                  <PrintCostHint cost={printCost} field="hardcoverCost" price={priceForm.watch("pricePrintHardcover")} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Чорно-білий друк (дешевше в типографії) — заповніть, якщо хочете запропонувати покупцю
                  дешевший варіант поруч із кольоровим
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pricePrintBw">Друк ч/б, м&apos;яка (грн)</Label>
                    <Input
                      id="pricePrintBw"
                      type="number"
                      step="0.01"
                      min="0"
                      {...priceForm.register("pricePrintBw")}
                      placeholder="149.99"
                    />
                    {priceForm.formState.errors.pricePrintBw && (
                      <p className="text-xs text-red-500">{priceForm.formState.errors.pricePrintBw.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pricePrintHardcoverBw">Друк ч/б, тверда (грн)</Label>
                    <Input
                      id="pricePrintHardcoverBw"
                      type="number"
                      step="0.01"
                      min="0"
                      {...priceForm.register("pricePrintHardcoverBw")}
                      placeholder="229.99"
                    />
                    {priceForm.formState.errors.pricePrintHardcoverBw && (
                      <p className="text-xs text-red-500">{priceForm.formState.errors.pricePrintHardcoverBw.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {priceError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{priceError}</div>
              )}
              {priceSaved && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
              )}

              <Button type="submit" loading={priceForm.formState.isSubmitting}>
                Зберегти зміни
              </Button>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold mb-1">Платформи розповсюдження</h2>
              <p className="text-xs text-gray-500 mb-4">Оберіть, де продавати книгу. Можна вибрати кілька.</p>
              <DistributionChannelPicker
                bookId={id}
                language={book?.language}
                initialDesiredRoyaltyAmount={book?.desiredRoyaltyAmount}
              />
            </div>

            {book?.status === "PUBLISHED" && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <KdpSelectPanel bookId={id} bookStatus={book.status} />
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-gray-50 p-5 space-y-3 text-sm">
              <Row label="Назва" value={book?.title || "—"} />
              <Row label="Жанр" value={book?.genre || "—"} />
              <Row label="Кількість сторінок" value={book?.pageCount ? `${book.pageCount} ст.` : "—"} />
              <Row label="Рукопис" value={book?.originalDocxUrl ? "Завантажено" : "Не завантажено"} />
              <Row label="Е-книга" value={book?.priceEbook ? `${Number(book.priceEbook).toFixed(2)} грн` : "Не продається"} />
              <Row label="Друк, м'яка (кольор.)" value={book?.pricePrint ? `${Number(book.pricePrint).toFixed(2)} грн` : "Не продається"} />
              <Row label="Друк, тверда (кольор.)" value={book?.pricePrintHardcover ? `${Number(book.pricePrintHardcover).toFixed(2)} грн` : "Не продається"} />
              <Row label="Друк, м'яка (ч/б)" value={book?.pricePrintBw ? `${Number(book.pricePrintBw).toFixed(2)} грн` : "Не продається"} />
              <Row label="Друк, тверда (ч/б)" value={book?.pricePrintHardcoverBw ? `${Number(book.pricePrintHardcoverBw).toFixed(2)} грн` : "Не продається"} />
              <Row label="Платформи" value={book?.distributionChannels?.length ? `${book.distributionChannels.length} обрано` : "Не обрано"} />
            </div>

            {book?.pricePrint || book?.pricePrintHardcover || book?.pricePrintBw || book?.pricePrintHardcoverBw ? (
              <IsbnReadinessChecklist book={book} bookAuthors={bookAuthors} />
            ) : null}

            {!!book?.distributionChannels?.length && (
              <div className="rounded-xl border bg-white p-5 space-y-4 text-sm">
                <div>
                  <h2 className="text-base font-semibold">Орієнтовний прибуток по каналах</h2>
                  <p className="text-xs text-gray-500">
                    Сума за один проданий примірник, за вирахуванням комісії платформи. Ціна вказана за книжку — це
                    вартість до відрахування цих комісій.
                  </p>
                </div>
                {[
                  { label: "Е-книга", price: book?.priceEbook },
                  { label: "Друк, м'яка (кольор.)", price: book?.pricePrint },
                  { label: "Друк, тверда (кольор.)", price: book?.pricePrintHardcover },
                  { label: "Друк, м'яка (ч/б)", price: book?.pricePrintBw },
                  { label: "Друк, тверда (ч/б)", price: book?.pricePrintHardcoverBw },
                ]
                  .filter((f) => f.price)
                  .map((f) => {
                    const price = Number(f.price);
                    return (
                      <div key={f.label} className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {f.label} — {price.toFixed(2)} грн
                        </p>
                        <div className="space-y-1 pl-1">
                          {book!.distributionChannels!.map((key) => {
                            const platform = DISTRIBUTION_PLATFORMS.find((p) => p.key === key);
                            if (!platform) return null;
                            const min = price * platform.royaltyMin;
                            const max = price * platform.royaltyMax;
                            const value =
                              min === max ? `${min.toFixed(2)} грн` : `${min.toFixed(2)}–${max.toFixed(2)} грн`;
                            return <Row key={key} label={platform.name} value={value} />;
                          })}
                        </div>
                      </div>
                    );
                  })}
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

            <Button className="w-full" onClick={() => router.push(`/dashboard/books/${id}`)}>
              До дашборду книги →
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            ← Назад
          </Button>
          {step < STEP_META.length - 1 && (
            <Button onClick={() => setStep((s) => Math.min(STEP_META.length - 1, s + 1))}>
              Далі →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutputDataPage() {
  return (
    <Suspense>
      <OutputDataContent />
    </Suspense>
  );
}
