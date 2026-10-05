"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ChevronUp, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "#50a406";

interface CreationInfo {
  title: string;
  genre?: string | null;
  originalDocxUrl?: string | null;
  manuscriptImportedAt?: string | null;
  manuscriptEditedAt?: string | null;
  priceEbook?: string | number | null;
  pricePrint?: string | number | null;
  pricePrintHardcover?: string | number | null;
  coverUrl?: string | null;
  printPdfUrl?: string | null;
  udcCode?: string | null;
}

interface Props {
  bookId: string;
  createdAt: string;
  timeline?: Record<string, string> | null;
  contractAcceptedAt?: string | null;
  isbn?: string | null;
  bookStatus: string;
  distributionChannels: string[];
  creation: CreationInfo;
  // The four "Вихідні дані" sections as the shared readiness checks see
  // them (isPublishStepComplete, shared-types) -- the same answer the
  // output-data tabs, the sidebar dot and the backend's pre-publish gate
  // give. This card used to keep its own looser idea of "filled in" (title +
  // genre was enough for a green ✓ on "Основну інформацію заповнено").
  readiness: { info: boolean; file: boolean; cover: boolean; price: boolean };
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

// WF-SPEC "01 Дашборд" п.1-4: a flat 13-item checklist (not the old nested
// per-channel timeline, which moved to the dedicated "Публікація" page --
// BookDistribution.tsx already covers D2D/KDP/Google there). УДК входить у
// 13 (WF-SPEC "Рішення цієї сесії"), але сама по собі НІКОЛИ не є "наступним
// кроком" -- це не дія автора, а статус, що показується окремим бейджем
// (в процесі / необов'язково / отримано); next-step highlighting skips it.
interface StepItem {
  key: string;
  label: string;
  done: boolean;
  date?: string | null;
  href?: string;
  skipAsNextStep?: boolean;
  badge?: { text: string; tone: "amber" | "gray" | "green" };
}

interface NextStepContent {
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

function udcBadge(hasPrintPrice: boolean, udcCode: string | null | undefined): StepItem["badge"] {
  if (udcCode) return { text: "отримано", tone: "green" };
  if (!hasPrintPrice) return { text: "необов'язково", tone: "gray" };
  return { text: "в процесі", tone: "amber" };
}

function badgeClasses(tone: "amber" | "gray" | "green") {
  if (tone === "green") return "bg-green-50 text-green-700 ring-1 ring-green-200";
  if (tone === "amber") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-gray-100 text-gray-600";
}

export function BookStepsCard({
  bookId,
  createdAt,
  timeline,
  contractAcceptedAt,
  isbn,
  bookStatus,
  distributionChannels,
  creation,
  readiness,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasBasicInfo = readiness.info;
  const hasManuscript = readiness.file;
  const manuscriptDate = creation.manuscriptEditedAt ?? creation.manuscriptImportedAt;
  const hasPrice = readiness.price;
  const hasPrintPrice = !!(creation.pricePrint || creation.pricePrintHardcover);
  const hasCover = readiness.cover;
  const hasDistribution = distributionChannels.length > 0;
  const outputDataFilled = hasBasicInfo && hasPrice;
  const isSubmitted = bookStatus !== "DRAFT" && bookStatus !== "PROCESSING";
  const publishedDone = (bookStatus === "PUBLISHED" || bookStatus === "UNPUBLISHED") && !!isbn;
  const submittedDone = !!timeline?.submitted;
  const reviewDone = !!timeline?.review_done;
  const contractDone = !!contractAcceptedAt;

  const items: StepItem[] = [
    { key: "info", label: "Основну інформацію заповнено", done: hasBasicInfo, href: `/dashboard/books/${bookId}/output-data` },
    { key: "manuscript", label: "Рукопис завантажено", done: hasManuscript, date: hasManuscript ? manuscriptDate : undefined, href: `/dashboard/books/${bookId}/manuscript` },
    { key: "price", label: "Ціну встановлено", done: hasPrice, href: `/dashboard/books/${bookId}/output-data/price` },
    { key: "cover", label: "Обкладинку додано", done: hasCover, href: `/dashboard/books/${bookId}/cover` },
    { key: "distribution", label: "Платформи розповсюдження обрано", done: hasDistribution, href: `/dashboard/books/${bookId}/output-data/price` },
    { key: "review-pre", label: "Огляд перед публікацією пройдено", done: isSubmitted, href: `/dashboard/books/${bookId}/output-data/review` },
    {
      key: "udc",
      label: "Отримати УДК",
      done: !!creation.udcCode,
      skipAsNextStep: true,
      badge: udcBadge(hasPrintPrice, creation.udcCode),
    },
    { key: "submitted", label: "Надіслано на публікацію", done: submittedDone, date: timeline?.submitted, href: `/dashboard/books/${bookId}/output-data/review` },
    { key: "submitted-info", label: "Вихідні дані заповнено", done: outputDataFilled, href: `/dashboard/books/${bookId}/output-data` },
    { key: "submitted-distribution", label: "Магазини та розмір роялті обрано", done: hasDistribution, href: `/dashboard/books/${bookId}/output-data/price` },
    { key: "review", label: "Перевірку завершено", done: reviewDone },
    { key: "contract", label: "Договір укладено", done: contractDone, date: contractAcceptedAt, href: "/dashboard/settings/contract" },
    { key: "published", label: "Публікація у магазинах", done: publishedDone, href: `/dashboard/books/${bookId}/publish` },
  ];

  const doneCount = items.filter((it) => it.done).length;
  const total = items.length;

  const nextStep = items.find((it) => !it.done && !it.skipAsNextStep);

  const NEXT_STEP_CONTENT: Record<string, NextStepContent> = {
    info: {
      title: "Заповніть вихідні дані",
      description: "Назва, опис, жанр, автори — основа сторінки книги.",
      cta: { label: "Заповнити вихідні дані", href: `/dashboard/books/${bookId}/output-data` },
    },
    manuscript: {
      title: "Завантажте рукопис",
      description: "Файл .docx — основа для електронної та друкованої версій книги.",
      cta: { label: "Завантажити рукопис", href: `/dashboard/books/${bookId}/manuscript` },
    },
    price: {
      title: "Встановіть ціну",
      description: "Оберіть гонорар за електронний і друкований примірник.",
      cta: { label: "Встановити ціну", href: `/dashboard/books/${bookId}/output-data/price` },
    },
    cover: {
      title: "Додайте обкладинку",
      description: "Готовий шаблон або власний файл — обкладинка потрібна для публікації.",
      cta: { label: "Додати обкладинку", href: `/dashboard/books/${bookId}/cover` },
    },
    distribution: {
      title: "Оберіть платформи розповсюдження",
      description: "ULIT, Amazon KDP, Draft2Digital, Google Play — де продаватиметься книга.",
      cta: { label: "Обрати платформи", href: `/dashboard/books/${bookId}/output-data/price` },
    },
    "review-pre": {
      title: "Перегляньте книгу перед публікацією",
      description: "Останній крок перед надсиланням на модерацію.",
      cta: { label: "Перейти до огляду", href: `/dashboard/books/${bookId}/output-data/review` },
    },
    submitted: {
      title: "Надішліть книгу на публікацію",
      description: "Перевірте огляд і натисніть «Надіслати на модерацію» — далі книгу перевірить адміністратор.",
      cta: { label: "Перейти до огляду", href: `/dashboard/books/${bookId}/output-data/review` },
    },
    "submitted-info": {
      title: "Заповніть вихідні дані",
      description: "Назва, опис, жанр, автори — основа сторінки книги.",
      cta: { label: "Заповнити вихідні дані", href: `/dashboard/books/${bookId}/output-data` },
    },
    "submitted-distribution": {
      title: "Оберіть магазини та розмір роялті",
      description: "ULIT, Amazon KDP, Draft2Digital, Google Play — де продаватиметься книга.",
      cta: { label: "Обрати магазини", href: `/dashboard/books/${bookId}/output-data/price` },
    },
    review: {
      title: "Книга на перевірці",
      description: "Адміністратор перевіряє книгу. Ми повідомимо, щойно перевірку завершено — зазвичай це 1–3 робочі дні.",
    },
    contract: {
      title: "Підпишіть договір автора",
      description: "Договір підписується один раз і діє для всіх ваших книг.",
      cta: { label: "Перейти до договору", href: "/dashboard/settings/contract" },
    },
    published: {
      title: "Публікація у магазинах",
      description:
        "Ми передаємо книгу в Amazon, Google Play, Apple Books та інші магазини. Зазвичай це 3–10 робочих днів — статус кожного магазину видно на сторінці публікації.",
      cta: { label: "Переглянути публікацію", href: `/dashboard/books/${bookId}/publish` },
    },
  };

  const heroKey = nextStep?.key ?? "published";
  const hero = NEXT_STEP_CONTENT[heroKey];
  const heroDone = !nextStep;

  return (
    <div className="space-y-4">
      {/* "Наступний крок" -- WF-SPEC п.1 */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-green-200 bg-green-50/60 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
          <Store size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Наступний крок · {doneCount} з {total}
          </div>
          <div className="text-[17px] font-bold text-black">{hero.title}</div>
          <p className="mt-0.5 text-[13px] text-gray-700">{hero.description}</p>
        </div>
        {hero.cta && (
          <Link
            href={hero.cta.href}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-4 text-sm font-medium",
              heroDone
                ? "bg-green-600 text-white shadow-sm hover:bg-green-700"
                : "border border-black bg-white text-black hover:bg-gray-50"
            )}
          >
            {hero.cta.label}
            <ArrowRight size={14} />
          </Link>
        )}
      </section>

      {/* Згорнутий список "N з 13 кроків" -- WF-SPEC п.2-4 */}
      <div className="rounded-xl border border-gray-200">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <Check size={14} />
          </span>
          <span className="text-[15px] font-semibold text-black">
            {doneCount} з {total} кроків виконано
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-gray-500">
            {expanded ? "Згорнути" : "Показати"}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {expanded && (
          <ol className="space-y-1.5 border-t border-gray-100 px-4 py-3">
            {items.map((it) => (
              <li key={it.key} className="flex items-start gap-2.5 text-sm">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    it.done ? "text-white" : "border border-gray-300 text-gray-300"
                  )}
                  style={it.done ? { backgroundColor: ACCENT } : undefined}
                >
                  {it.done && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  {it.href && !it.done ? (
                    <Link href={it.href} className="font-medium text-black underline hover:no-underline">
                      {it.label}
                    </Link>
                  ) : (
                    <span className={cn("font-medium", it.done ? "" : "text-gray-400")} style={it.done ? { color: ACCENT } : undefined}>
                      {it.label}
                    </span>
                  )}
                  {it.date && <span className="ml-1 text-gray-500">· {fmt(it.date)}</span>}
                  {it.badge && (
                    <span className={cn("ml-1.5 rounded-full px-1.5 py-px text-[11px] font-medium", badgeClasses(it.badge.tone))}>
                      {it.badge.text}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Поточний крок завжди видно окремим рядком, навіть коли список
            згорнуто -- WF-SPEC п.2. */}
        {!expanded && nextStep && (
          <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: ACCENT }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
            </span>
            <span className="text-sm font-medium text-black">{nextStep.label}</span>
            <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
              в процесі
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
