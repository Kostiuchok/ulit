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
import { useApi } from "../../hooks/useApi";
import { cn } from "../../lib/utils";

// ─── Step schemas ────────────────────────────────────────────────────────────

const step1Schema = z.object({
  title: z.string().min(1, "Назва обов'язкова").max(255),
  description: z.string().max(5000).optional(),
  genre: z.string().max(100).optional(),
  language: z.string().length(2).default("uk"),
});

const step3Schema = z.object({
  priceEbook: z.coerce.number().positive("Вкажіть коректну ціну").optional().or(z.literal("")),
  pricePrint: z.coerce.number().positive("Вкажіть коректну ціну").optional().or(z.literal("")),
  pricePrintHardcover: z.coerce.number().positive("Вкажіть коректну ціну").optional().or(z.literal("")),
});

type Step1Form = z.infer<typeof step1Schema>;
type Step3Form = z.infer<typeof step3Schema>;

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Інформація" },
  { label: "Файл" },
  { label: "Ціна" },
  { label: "Розповсюдження" },
  { label: "Огляд" },
];

const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
];

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

interface ConversionJobStatus {
  format: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  progress?: number;
}

type PrintCost =
  | { status: "DONE"; softcoverCost: number; hardcoverCost: number }
  | { status: "NO_PAGE_COUNT" }
  | { status: "NO_SETTINGS" };

type ManuscriptStage = "idle" | "polling" | "done" | "failed" | "skipped";

export function BookWizard() {
  const router = useRouter();
  const { apiFetch } = useApi();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [channels, setChannels] = useState<string[]>(["ULIT", "D2D", "KDP", "GOOGLE"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const step1 = useForm<Step1Form>({ resolver: zodResolver(step1Schema), defaultValues: { language: "uk" } });
  const step3 = useForm<Step3Form>({ resolver: zodResolver(step3Schema) });

  // ── Manuscript upload → print-cost pipeline (step "Файл") ──────────────────
  async function checkPrintConversion(bookId: string) {
    try {
      const { jobs } = await apiFetch<{ jobs: ConversionJobStatus[] }>(`/api/books/${bookId}/conversion-status`);
      const printJob = jobs.find((j) => j.format === "PRINT_PDF");
      if (printJob?.status !== "DONE" && printJob?.status !== "FAILED") {
        if (typeof printJob?.progress === "number") setPrintProgress(printJob.progress);
        return;
      }

      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

      if (printJob.status === "DONE") {
        const cost = await apiFetch<PrintCost>(`/api/books/${bookId}/print-cost`);
        setPrintCost(cost);
        setManuscriptStage("done");
      } else {
        setManuscriptStage("failed");
      }
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
      if (!draft) {
        const { book } = await apiFetch<{ book: BookDraft }>("/api/books", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setDraft(book);
      } else {
        await apiFetch(`/api/books/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }
      setStep(1);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  });

  // ── Step 3: Pricing ─────────────────────────────────────────────────────────
  const submitStep3 = step3.handleSubmit(async (data) => {
    setError("");
    if (!draft) return;
    setSaving(true);
    try {
      await apiFetch(`/api/books/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          priceEbook: data.priceEbook || undefined,
          pricePrint: data.pricePrint || undefined,
          pricePrintHardcover: data.pricePrintHardcover || undefined,
        }),
      });
      setStep(3);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  });

  // ── Step 4: Distribution ────────────────────────────────────────────────────
  async function submitDistribution() {
    setError("");
    if (!draft) return;
    setSaving(true);
    try {
      await apiFetch(`/api/books/${draft.id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionChannels: channels }),
      });
      setStep(4);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  // ─── Progress bar ────────────────────────────────────────────────────────────
  const progress = (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-gray-200 text-gray-400"
                )}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className={cn("mt-1 text-xs", i === step ? "text-gray-900 font-medium" : "text-gray-400")}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-1 mb-5", i < step ? "bg-primary" : "bg-gray-200")} />
            )}
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
            <Label htmlFor="description">Опис</Label>
            <textarea
              id="description"
              {...step1.register("description")}
              placeholder="Короткий опис книги…"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

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
              <Label htmlFor="language">Мова</Label>
              <select
                id="language"
                {...step1.register("language")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

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

  // Step 2 — Pricing
  if (step === 2) {
    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Формати та ціни</h2>
        <p className="text-sm text-gray-500 mb-6">Вкажіть ціну для форматів, які хочете продавати. Залиште порожнім щоб не продавати.</p>

        <form onSubmit={submitStep3} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📱</span>
                <p className="font-medium">Е-книга</p>
              </div>
              <p className="text-xs text-gray-500">EPUB, FB2, MOBI — для читалок і смартфонів</p>
              <div className="space-y-1">
                <Label htmlFor="priceEbook">Ціна (грн)</Label>
                <Input
                  id="priceEbook"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="49.99"
                  {...step3.register("priceEbook")}
                />
                {step3.formState.errors.priceEbook && (
                  <p className="text-xs text-red-500">{step3.formState.errors.priceEbook.message}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📗</span>
                <p className="font-medium">Друкована, м&apos;яка обкладинка</p>
              </div>
              <p className="text-xs text-gray-500">PDF/X-3 для типографії — замовлення на друк</p>
              <div className="space-y-1">
                <Label htmlFor="pricePrint">Ціна (грн)</Label>
                <Input
                  id="pricePrint"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="199.99"
                  {...step3.register("pricePrint")}
                />
                {step3.formState.errors.pricePrint && (
                  <p className="text-xs text-red-500">{step3.formState.errors.pricePrint.message}</p>
                )}
                <PrintCostHint cost={printCost} field="softcoverCost" onGoToUpload={() => setStep(1)} />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📘</span>
                <p className="font-medium">Друкована, тверда обкладинка</p>
              </div>
              <p className="text-xs text-gray-500">PDF/X-3 для типографії — замовлення на друк</p>
              <div className="space-y-1">
                <Label htmlFor="pricePrintHardcover">Ціна (грн)</Label>
                <Input
                  id="pricePrintHardcover"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="299.99"
                  {...step3.register("pricePrintHardcover")}
                />
                {step3.formState.errors.pricePrintHardcover && (
                  <p className="text-xs text-red-500">{step3.formState.errors.pricePrintHardcover.message}</p>
                )}
                <PrintCostHint cost={printCost} field="hardcoverCost" onGoToUpload={() => setStep(1)} />
              </div>
            </div>
          </div>

          {errorBanner}
          <div className="flex justify-between">
            <Button variant="outline" type="button" onClick={() => setStep(1)}>← Назад</Button>
            <Button type="submit" loading={saving}>Зберегти і перейти на наступний крок →</Button>
          </div>
        </form>
      </div>
    );
  }

  // Step 3 — Distribution channels
  if (step === 3) {
    const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");

    const toggleChannel = (key: string) => {
      if (key === "ULIT") return;
      setChannels((prev) =>
        prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
      );
    };

    const platforms = [
      {
        key: "ULIT",
        icon: "📚",
        name: "Магазин Ulit",
        royalty: "70%",
        description: "Власний магазин платформи. Завжди увімкнений.",
        locked: true,
      },
      {
        key: "D2D",
        icon: "🌐",
        name: "Draft2Digital",
        royalty: "60%",
        description: "40+ ритейлерів: Barnes & Noble, Kobo, Apple Books та інші.",
        locked: false,
      },
      {
        key: "KDP",
        icon: "🔶",
        name: "Amazon KDP",
        royalty: "35–70%",
        description: "Amazon Kindle Store. Якщо обрано без D2D і Google — активується KDP Select (90 днів ексклюзивності).",
        locked: false,
      },
      {
        key: "GOOGLE",
        icon: "🎮",
        name: "Google Play Books",
        royalty: "52%",
        description: "Google Play Books Store.",
        locked: false,
      },
    ];

    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Платформи розповсюдження</h2>
        <p className="text-sm text-gray-500 mb-6">Оберіть, де продавати книгу. Можна вибрати кілька.</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {platforms.map((p) => {
            const selected = channels.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => toggleChannel(p.key)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300",
                  p.locked && "cursor-default"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.icon}</span>
                    <span className="font-semibold text-sm">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-green-600">{p.royalty}</span>
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                      selected ? "border-primary bg-primary" : "border-gray-300"
                    )}>
                      {selected && <span className="text-white text-[10px] leading-none">✓</span>}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">{p.description}</p>
                {p.locked && <p className="mt-1 text-xs text-gray-400">Не можна вимкнути</p>}
              </button>
            );
          })}
        </div>

        {isKdpSelect && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <span className="font-medium">KDP Select (Kindle Unlimited)</span> — ексклюзивна угода з Amazon на 90 днів.
            Протягом цього часу книга не може продаватись на D2D та Google Play Books.
          </div>
        )}

        {errorBanner}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(2)}>← Назад</Button>
          <Button onClick={submitDistribution} loading={saving}>Зберегти і перейти на наступний крок →</Button>
        </div>
      </div>
    );
  }

  // Step 4 — Review + finish
  if (step === 4) {
    const s1 = step1.getValues();
    const s3 = step3.getValues();

    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Огляд та публікація</h2>
        <p className="text-sm text-gray-500 mb-6">Перевірте дані перед відправкою на модерацію.</p>

        <div className="rounded-xl border bg-gray-50 p-5 space-y-4 text-sm mb-6">
          <Row label="Назва" value={s1.title} />
          <Row label="Жанр" value={s1.genre || "—"} />
          <Row label="Мова" value={LANGUAGES.find((l) => l.code === s1.language)?.label || s1.language} />
          <Row
            label="Е-книга"
            value={s3.priceEbook ? `${Number(s3.priceEbook).toFixed(2)} грн` : "Не продається"}
          />
          <Row
            label="Друк, м'яка"
            value={s3.pricePrint ? `${Number(s3.pricePrint).toFixed(2)} грн` : "Не продається"}
          />
          <Row
            label="Друк, тверда"
            value={s3.pricePrintHardcover ? `${Number(s3.pricePrintHardcover).toFixed(2)} грн` : "Не продається"}
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
          <Button variant="outline" onClick={() => setStep(3)}>← Назад</Button>
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

function PrintCostHint({
  cost,
  field,
  onGoToUpload,
}: {
  cost: PrintCost | null;
  field: "softcoverCost" | "hardcoverCost";
  onGoToUpload: () => void;
}) {
  if (cost?.status === "DONE") {
    return (
      <p className="text-xs text-gray-400">
        Собівартість виготовлення: ~{cost[field].toFixed(2)} грн
      </p>
    );
  }
  if (cost?.status === "NO_SETTINGS") {
    return <p className="text-xs text-gray-400">Собівартість друку ще не налаштована адміном</p>;
  }
  return (
    <button type="button" onClick={onGoToUpload} className="text-xs text-gray-400 underline hover:text-gray-600">
      Завантажте рукопис, щоб побачити собівартість
    </button>
  );
}
