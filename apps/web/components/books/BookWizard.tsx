"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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

export function BookWizard() {
  const router = useRouter();
  const { apiFetch } = useApi();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [distribution, setDistribution] = useState<"WIDE" | "KDP_SELECT">("WIDE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const step1 = useForm<Step1Form>({ resolver: zodResolver(step1Schema), defaultValues: { language: "uk" } });
  const step3 = useForm<Step3Form>({ resolver: zodResolver(step3Schema) });

  // ── Step 1: Basic info ──────────────────────────────────────────────────────
  const submitStep1 = step1.handleSubmit(async (data) => {
    setError("");
    setSaving(true);
    try {
      if (!draft) {
        const { book } = await apiFetch<{ book: BookDraft }>("/api/books", {
          method: "POST",
          body: JSON.stringify({ ...data, distributionStrategy: distribution }),
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
      // Use the distribution endpoint so KDP Select expiry is set correctly
      await apiFetch(`/api/books/${draft.id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionStrategy: distribution }),
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
            <Button type="submit" loading={saving}>Далі →</Button>
          </div>
        </form>
      </div>
    );
  }

  // Step 1 — Upload DOCX (Phase 4 will wire up the actual job)
  if (step === 1) {
    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Завантажити рукопис</h2>
        <p className="text-sm text-gray-500 mb-6">Підтримуються файли .docx (Word). Максимальний розмір — 50 MB.</p>

        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-sm font-medium text-gray-700">Завантаження DOCX буде доступне в наступному оновленні</p>
          <p className="text-xs text-gray-400 mt-1">Ви зможете перейти далі та повернутись до завантаження пізніше</p>
        </div>

        {errorBanner}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(0)}>← Назад</Button>
          <Button onClick={() => setStep(2)}>Далі →</Button>
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
          <div className="grid grid-cols-2 gap-6">
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
                <p className="font-medium">Друкована книга</p>
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
              </div>
            </div>
          </div>

          {errorBanner}
          <div className="flex justify-between">
            <Button variant="outline" type="button" onClick={() => setStep(1)}>← Назад</Button>
            <Button type="submit" loading={saving}>Далі →</Button>
          </div>
        </form>
      </div>
    );
  }

  // Step 3 — Distribution strategy
  if (step === 3) {
    return (
      <div>
        {progress}
        <h2 className="text-lg font-semibold mb-2">Стратегія розповсюдження</h2>
        <p className="text-sm text-gray-500 mb-6">Оберіть, де продавати книгу.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* WIDE */}
          <button
            type="button"
            onClick={() => setDistribution("WIDE")}
            className={cn(
              "rounded-xl border-2 p-5 text-left transition-colors",
              distribution === "WIDE" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="text-2xl mb-2">🌐</div>
              {distribution === "WIDE" && <span className="text-xs font-semibold text-primary">Вибрано</span>}
            </div>
            <p className="font-semibold">Широке розповсюдження</p>
            <p className="mt-1 text-sm text-gray-500">
              Продаж на Knyha, Draft2Digital, Google Play Books та KDP одночасно.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li>✓ Knyha.ua — власний магазин</li>
              <li>✓ Draft2Digital → 40+ ритейлерів</li>
              <li>✓ Google Play Books</li>
              <li>✓ Amazon KDP (без ексклюзиву)</li>
            </ul>
          </button>

          {/* KDP SELECT */}
          <button
            type="button"
            onClick={() => setDistribution("KDP_SELECT")}
            className={cn(
              "rounded-xl border-2 p-5 text-left transition-colors",
              distribution === "KDP_SELECT" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="text-2xl mb-2">🔶</div>
              {distribution === "KDP_SELECT" && <span className="text-xs font-semibold text-primary">Вибрано</span>}
            </div>
            <p className="font-semibold">KDP Select (Kindle Unlimited)</p>
            <p className="mt-1 text-sm text-gray-500">
              Ексклюзивно на Amazon на 90 днів. Доступна підписникам Kindle Unlimited.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li>✓ Amazon KDP Select</li>
              <li>✓ Kindle Unlimited (KU)</li>
              <li>⏸ Draft2Digital — призупинено</li>
              <li>⏸ Google Play — призупинено</li>
            </ul>
            <p className="mt-3 text-xs text-amber-600 font-medium">⚠ 90-денний ексклюзив на Amazon</p>
          </button>
        </div>

        {errorBanner}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(2)}>← Назад</Button>
          <Button onClick={submitDistribution} loading={saving}>Далі →</Button>
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
            label="Друк"
            value={s3.pricePrint ? `${Number(s3.pricePrint).toFixed(2)} грн` : "Не продається"}
          />
          <Row
            label="Стратегія"
            value={distribution === "WIDE" ? "Широке розповсюдження" : "KDP Select (ексклюзив)"}
          />
          {draft && <Row label="ID чернетки" value={draft.id} mono />}
        </div>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 mb-6">
          <strong>Наступний крок після збереження чернетки:</strong> завантажте DOCX-рукопис та обкладинку,
          після чого книга буде відправлена на модерацію.
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
