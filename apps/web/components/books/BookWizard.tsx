"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DocxUploader } from "../dashboard/DocxUploader";
import { ProBadge } from "../ui/pro-badge";
import { useApi } from "../../hooks/useApi";
import { cn } from "../../lib/utils";
import { PRINT_FORMATS, PRINT_FORMAT_KEYS, type PrintFormatKey } from "shared-types";
import { FormatsAndDistribution, computeAnchorPrices, type PrintCost } from "../books/FormatsAndDistribution";

// ─── Step schemas ────────────────────────────────────────────────────────────

// Same bounds as output-data/page.tsx's "Анотація" field and
// apps/api/src/modules/books/publish.ts's DESCRIPTION_MIN_LENGTH/MAX_LENGTH —
// this is the same Book.description column, just filled in earlier in the
// flow, so it must validate identically wherever it's edited.
const DESCRIPTION_MIN_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;

const step1Schema = z.object({
  title: z.string().min(1, "Назва обов'язкова").max(255),
  description: z
    .string()
    .min(DESCRIPTION_MIN_LENGTH, `Анотація має містити щонайменше ${DESCRIPTION_MIN_LENGTH} символів`)
    .max(DESCRIPTION_MAX_LENGTH, `Анотація має містити не більше ${DESCRIPTION_MAX_LENGTH} символів`),
  genre: z.string().max(100).optional(),
  // Independent from genre -- the author picks this directly from
  // PRINT_FORMAT_KEYS (shared-types), which is also PRINT_FORMATS' source
  // of truth for the actual mm values.
  printFormatKey: z.string().min(1, "Оберіть розмір книги"),
  language: z.string().length(2).default("uk"),
  ageRating: z.string().min(1, "Вкажіть вікові обмеження"),
});

type Step1Form = z.infer<typeof step1Schema>;

// ─── Constants ───────────────────────────────────────────────────────────────

// T-2075 -- steps 2 ("Ціна") and 3 ("Розповсюдження") used to be separate:
// asking for a final shelf price BEFORE the author picked which channels the
// book would sell through was backwards -- channels/commissions are exactly
// what determines a workable shelf price, and the two steps also visibly
// duplicated "which stores" (raw price step implied all of them, the actual
// channel step let you pick). Merged into one step matching Ridero's
// "Опубликовать в магазинах" page (docs/ridero-research-preview-cover.md
// section 8) -- see FormatsAndDistribution.tsx for the actual UI/formula.
const STEPS = [
  { label: "Інформація" },
  { label: "Файл" },
  { label: "Розповсюдження" },
  { label: "Огляд" },
];

const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
];

// Book size is its own independent selection here, not derived from genre --
// the author picks any genre and any size, freely combined. Same ordered
// list (PRINT_FORMAT_KEYS, shared-types) the output-data page's own size
// selector uses, so creation-time and post-creation editing never drift.

// Same list as output-data/page.tsx's AGE_RATINGS — both write the same
// Book.ageRating column, required by publish.ts's pre-publish validation.
const AGE_RATINGS = ["0+", "0-6", "6-10", "11-14", "15-17", "18+"];

const LANGUAGES = [
  { code: "uk", label: "Українська" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "pl", label: "Polski" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface BookDraft {
  id: string;
  title: string;
  slug: string;
}

type ManuscriptStage = "idle" | "polling" | "done" | "failed" | "skipped";

export function BookWizard() {
  const router = useRouter();
  const { apiFetch } = useApi();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [channels, setChannels] = useState<string[]>(["ULIT", "D2D", "KDP", "GOOGLE"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [royaltyEbook, setRoyaltyEbook] = useState("");
  const [royaltyPrint, setRoyaltyPrint] = useState("");

  const [manuscriptStage, setManuscriptStage] = useState<ManuscriptStage>("idle");
  const [printCost, setPrintCost] = useState<PrintCost | null>(null);
  const [printProgress, setPrintProgress] = useState(0);
  const [pollElapsed, setPollElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const step1 = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: { language: "uk", printFormatKey: "standard" },
  });

  // ── Manuscript upload → print-cost pipeline (step "Файл") ──────────────────
  // T-2057 moved print-PDF rendering off the upload-time job batch: it now
  // renders straight from Book.manuscriptContent (WeasyPrint), which only
  // exists once the manuscript has been imported. There is no longer a
  // ConversionJob row for "PRINT_PDF" to poll (fixed T-2069 — this used to
  // poll /conversion-status for a job that's never created, so the spinner
  // never resolved regardless of document size). Getting a page-count
  // estimate here means driving the same on-demand chain the manuscript
  // editor uses: GET /manuscript (imports the .docx) → GET /print-preview
  // (renders the print PDF off it) → /print-cost.
  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  async function checkPrintConversion(bookId: string) {
    try {
      const manuscript = await apiFetch<{ status: string; progress?: number }>(
        `/api/books/${bookId}/manuscript`
      );
      if (manuscript.status === "PROCESSING") {
        const p = typeof manuscript.progress === "number" ? manuscript.progress : 0;
        setPrintProgress(Math.round(p / 2)); // import = first half of the bar
        return;
      }
      if (manuscript.status !== "DONE") {
        stopPolling();
        setManuscriptStage("failed");
        return;
      }

      const preview = await apiFetch<{ status: string; progress?: number }>(
        `/api/books/${bookId}/print-preview`
      );
      if (preview.status === "PROCESSING") {
        const p = typeof preview.progress === "number" ? preview.progress : 0;
        setPrintProgress(50 + Math.round(p / 2)); // render = second half
        return;
      }
      if (preview.status !== "DONE") {
        stopPolling();
        setManuscriptStage("failed");
        return;
      }

      stopPolling();
      const cost = await apiFetch<PrintCost>(`/api/books/${bookId}/print-cost`);
      setPrintCost(cost);
      setManuscriptStage("done");
    } catch {
      // Transient network error — keep polling, don't abort the wizard.
    }
  }

  function handleDocxUploaded() {
    if (!draft) return;
    setManuscriptStage("polling");
    setPollElapsed(0);
    setPrintProgress(0);
    checkPrintConversion(draft.id);
    pollRef.current = setInterval(() => checkPrintConversion(draft.id), 3000);
    tickRef.current = setInterval(() => setPollElapsed((s) => s + 1), 1000);
  }

  function handleSkipUpload() {
    setManuscriptStage("skipped");
    setStep(2);
  }

  // ── Step 1: Basic info ──────────────────────────────────────────────────────
  const submitStep1 = step1.handleSubmit(async (data) => {
    setError("");
    setSaving(true);
    try {
      // Resolve the picked size to its actual mm values here so the request
      // always carries a consistent {printFormatKey, printWidthMm,
      // printHeightMm} triplet -- including on a re-submit of this step for
      // an existing draft (PATCH), where the backend no longer re-derives
      // size from genre once a book has any size on record.
      const format = PRINT_FORMATS[data.printFormatKey as PrintFormatKey] ?? PRINT_FORMATS.standard;
      const payload = {
        ...data,
        printFormatKey: format.key,
        printWidthMm: format.widthMm,
        printHeightMm: format.heightMm,
      };
      if (!draft) {
        const { book } = await apiFetch<{ book: BookDraft }>("/api/books", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setDraft(book);
      } else {
        await apiFetch(`/api/books/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      setStep(1);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  });

  // ── Step 2: Formats, royalty + distribution (merged T-2075) ────────────────
  function toggleChannel(key: string) {
    if (key === "ULIT") return;
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  async function submitFormatsAndDistribution() {
    setError("");
    if (!draft) return;
    setSaving(true);
    try {
      const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
      await apiFetch(`/api/books/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          desiredRoyaltyAmount: anchor.priceEbook !== undefined ? Number(royaltyEbook.replace(",", ".")) : undefined,
          desiredRoyaltyAmountPrint: anchor.pricePrint !== undefined ? Number(royaltyPrint.replace(",", ".")) : undefined,
          priceEbook: anchor.priceEbook,
          pricePrint: anchor.pricePrint,
          pricePrintHardcover: anchor.pricePrintHardcover,
        }),
      });
      await apiFetch(`/api/books/${draft.id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionChannels: channels }),
      });
      setStep(3);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  // ─── Progress bar ────────────────────────────────────────────────────────────
  // Fixed equal-width columns (grid, not flex) so all 4 steps stay the same
  // width regardless of label length. Connector lines are drawn as absolutely
  // positioned bars between circle centers (top-4 = half of the h-8 circle),
  // independent of the row's height — so a two-line label never pushes a
  // circle or line out of alignment with the others.
  const stepCenterPct = (i: number) => ((i + 0.5) / STEPS.length) * 100;
  const progress = (
    <div className="mb-8">
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
        {STEPS.slice(0, -1).map((_, i) => (
          <div
            key={i}
            className={cn("absolute top-4 h-0.5 -translate-y-1/2", i < step ? "bg-primary" : "bg-gray-200")}
            style={{ left: `${stepCenterPct(i)}%`, width: `${stepCenterPct(i + 1) - stepCenterPct(i)}%` }}
          />
        ))}
        {STEPS.map((s, i) => (
          <div key={i} className="relative z-10 flex flex-col items-center text-center px-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-gray-200 text-gray-400"
              )}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className={cn("mt-1.5 text-xs leading-snug", i === step ? "text-gray-900 font-medium" : "text-gray-400")}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Error banner ─────────────────────────────────────────────────────────────
  const errorBanner = error ? (
    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>
  ) : null;

  // ─── Step panels ─────────────────────────────────────────────────────────────

  // Step 0 — Basic info
  if (step === 0) {
    const descValue = step1.watch("description") ?? "";
    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-5">Основна інформація про книгу</h2>
        <form onSubmit={submitStep1} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Назва книги *</Label>
            <Input id="title" {...step1.register("title")} placeholder="Введіть назву" />
            {step1.formState.errors.title && (
              <p className="text-sm text-red-500">{step1.formState.errors.title.message}</p>
            )}
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
              {...step1.register("description")}
              rows={4}
              className={cn(
                "flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 resize-none",
                step1.formState.errors.description
                  ? "border-red-400 focus-visible:ring-red-300"
                  : "border-input focus-visible:ring-ring"
              )}
              placeholder={`Розкажіть читачам про вашу книгу… (від ${DESCRIPTION_MIN_LENGTH} до ${DESCRIPTION_MAX_LENGTH} символів)`}
            />
            {step1.formState.errors.description && (
              <p className="text-sm text-red-500">{step1.formState.errors.description.message}</p>
            )}
            <p className="text-xs text-gray-500">
              Ця анотація одразу з&apos;явиться на кроці &quot;Вихідні дані&quot; — редагувати можна буде тут або там, поле спільне.
            </p>
          </div>

          {/* Жанр і розмір книги більше не взаємопов'язані: автор обирає
              обидва незалежно, звідси й розміщені поруч в одному ряду.
              Раніше розмір автоматично випливав з жанру (GENRE_TO_PRINT_FORMAT) --
              тепер це лише fallback на бекенді, якщо книга взагалі без розміру. */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="genre">Жанр</Label>
              <select
                id="genre"
                {...step1.register("genre")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Оберіть жанр</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="printFormatKey">Розмір книги *</Label>
              <select
                id="printFormatKey"
                {...step1.register("printFormatKey")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PRINT_FORMAT_KEYS.map((key) => {
                  const f = PRINT_FORMATS[key];
                  return (
                    <option key={key} value={key}>
                      {f.label} ({f.widthMm}×{f.heightMm}мм)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="language">Мова</Label>
              <select
                id="language"
                {...step1.register("language")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ageRating">Вікові обмеження *</Label>
              <select
                id="ageRating"
                {...step1.register("ageRating")}
                className={cn(
                  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2",
                  step1.formState.errors.ageRating
                    ? "border-red-400 focus-visible:ring-red-300"
                    : "border-input focus-visible:ring-ring"
                )}
              >
                <option value="">Оберіть</option>
                {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {step1.formState.errors.ageRating && (
                <p className="text-sm text-red-500">{step1.formState.errors.ageRating.message}</p>
              )}
            </div>
          </div>

          {(() => {
            const formatKey = (step1.watch("printFormatKey") || "standard") as PrintFormatKey;
            const format = PRINT_FORMATS[formatKey] ?? PRINT_FORMATS.standard;
            const label = `${format.widthMm} × ${format.heightMm} мм (${format.label.toLowerCase()})`;
            return (
              <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm text-gray-600">
                Друкована версія книги матиме розмір <strong>{label}</strong>. Платформа сама переверстає
                текст під цей розмір при друці, тож розмір сторінки у вашому Word/Google Docs може
                бути будь-яким — це не завадить завантаженню.
              </div>
            );
          })()}

          {errorBanner}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Зберегти і перейти на наступний крок →</Button>
          </div>
        </form>
      </div>
    );
  }

  // Step 1 — Upload DOCX, then wait for the print-PDF job so we know the
  // real print page count before showing prices/cost estimates in step 2.
  if (step === 1) {
    const showUploader = manuscriptStage === "idle" && draft;

    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Завантажити рукопис</h2>
        <p className="text-sm text-gray-500 mb-6">
          Підтримуються файли .docx (Word). Максимальний розмір — 50 MB. Це дозволить показати
          орієнтовну собівартість друку на наступному кроці.
        </p>

        <details className="mb-6 rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-800">
            Технічні вимоги до тексту й ілюстрацій (натисніть, щоб розгорнути)
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Шрифт <strong>Times New Roman, 14 pt</strong>, міжрядковий інтервал <strong>1,5</strong></li>
            <li>Абзацні відступи — лише клавішею Enter, не пробілами чи табуляцією</li>
            <li>Не використовуйте примусовий розрив рядка (Shift+Enter) і ручні переноси дефісом</li>
            <li>Виноски — тільки інструментом Word (вставка виноски), не вручну</li>
            <li>Вірші — розділяйте строфи порожнім рядком (Enter)</li>
            <li>
              <ProBadge className="mr-1.5" />
              Ілюстрації для друку — файли .tif/.psd, 300 ppi, окремо від тексту (не .png/.gif —
              це веб-формати низької якості для друку); назва файлу має відповідати підпису в тексті
            </li>
          </ul>
        </details>

        {showUploader && (
          <DocxUploader bookId={draft!.id} onUploadSuccess={handleDocxUploaded} />
        )}

        {manuscriptStage === "polling" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-gray-50 p-12 text-center">
            <p className="text-sm text-gray-700">Готуємо друковану версію, щоб порахувати сторінки…</p>
            <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-gray-200">
              {printProgress > 0 ? (
                <div
                  className="absolute top-0 h-full rounded-full bg-gray-900 transition-all duration-500"
                  style={{ width: `${printProgress}%` }}
                />
              ) : (
                <div className="progress-indeterminate-bar absolute top-0 h-full rounded-full bg-gray-900" />
              )}
            </div>
            <p className="text-xs text-gray-400">
              {printProgress > 0 ? `${printProgress}% — ` : ""}
              {pollElapsed}с — зазвичай це займає менше хвилини
              {pollElapsed >= 45 && " (великий файл може тривати довше)"}
            </p>
          </div>
        )}

        {manuscriptStage === "done" && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <span>✓</span>
            <span>Рукопис оброблено. Собівартість друку буде показана на наступному кроці.</span>
          </div>
        )}

        {manuscriptStage === "failed" && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            <span>⚠</span>
            <span>Не вдалось підготувати друковану версію. Ви можете продовжити — собівартість друку буде недоступна, поки це не буде виправлено.</span>
          </div>
        )}

        {errorBanner}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(0)}>← Назад</Button>
          <div className="flex gap-2">
            {manuscriptStage !== "done" && manuscriptStage !== "polling" && (
              <Button variant="outline" onClick={handleSkipUpload}>Пропустити завантаження зараз</Button>
            )}
            <Button onClick={() => setStep(2)} disabled={manuscriptStage === "polling"}>
              {manuscriptStage === "done" ? "Зберегти і перейти на наступний крок →" : "Далі →"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2 — Formats, royalty + distribution (merged T-2075)
  if (step === 2) {
    const formatKey = (step1.watch("printFormatKey") || "standard") as PrintFormatKey;
    const format = PRINT_FORMATS[formatKey] ?? PRINT_FORMATS.standard;
    const formatLabel = `${format.widthMm}×${format.heightMm}мм (${format.label.toLowerCase()})`;

    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Формати, ціни та розповсюдження</h2>
        <p className="text-sm text-gray-500 mb-6">
          Вкажіть, скільки хочете заробляти з примірника — платформа порахує ціну для покупця.
          Оберіть канали окремо для друкованої та електронної книги.
        </p>

        <FormatsAndDistribution
          language={step1.watch("language")}
          formatLabel={formatLabel}
          printCost={printCost}
          channels={channels}
          onToggleChannel={toggleChannel}
          royaltyEbook={royaltyEbook}
          onRoyaltyEbookChange={setRoyaltyEbook}
          royaltyPrint={royaltyPrint}
          onRoyaltyPrintChange={setRoyaltyPrint}
        />

        {errorBanner}
        <div className="flex justify-between mt-6">
          <Button variant="outline" type="button" onClick={() => setStep(1)}>← Назад</Button>
          <Button onClick={submitFormatsAndDistribution} loading={saving}>Зберегти і перейти на наступний крок →</Button>
        </div>
      </div>
    );
  }

  // Step 3 — Review + finish
  if (step === 3) {
    const s1 = step1.getValues();
    const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
    const reviewFormat = PRINT_FORMATS[s1.printFormatKey as PrintFormatKey] ?? PRINT_FORMATS.standard;

    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Огляд та публікація</h2>
        <p className="text-sm text-gray-500 mb-6">Перевірте дані перед відправкою на модерацію.</p>

        <div className="rounded-xl border bg-gray-50 p-5 space-y-4 text-sm mb-6">
          <Row label="Назва" value={s1.title} />
          <Row label="Жанр" value={s1.genre || "—"} />
          <Row label="Розмір книги" value={`${reviewFormat.label} (${reviewFormat.widthMm}×${reviewFormat.heightMm}мм)`} />
          <Row label="Мова" value={LANGUAGES.find((l) => l.code === s1.language)?.label || s1.language} />
          <Row
            label="Е-книга"
            value={anchor.priceEbook !== undefined ? `${anchor.priceEbook.toFixed(2)} грн` : "Не продається"}
          />
          <Row
            label="Друк, м'яка"
            value={anchor.pricePrint !== undefined ? `${anchor.pricePrint.toFixed(2)} грн` : "Не продається"}
          />
          <Row
            label="Друк, тверда"
            value={anchor.pricePrintHardcover !== undefined ? `${anchor.pricePrintHardcover.toFixed(2)} грн` : "Не продається"}
          />
          <Row
            label="Стратегія"
            value={
              channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE")
                ? "KDP Select (ексклюзив)"
                : "Широке розповсюдження"
            }
          />
          {draft && <Row label="ID чернетки" value={draft.id} mono />}
        </div>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 mb-6">
          <strong>Наступний крок після збереження чернетки:</strong>{" "}
          {manuscriptStage === "done"
            ? "завантажте обкладинку, після чого книга буде відправлена на модерацію."
            : "завантажте рукопис (якщо пропустили) та обкладинку, після чого книга буде відправлена на модерацію."}
        </div>

        {errorBanner}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(2)}>← Назад</Button>
          <Button onClick={() => router.push(`/dashboard/books/${draft?.id}`)}>
            Зберегти чернетку →
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={cn("font-medium text-gray-900", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

