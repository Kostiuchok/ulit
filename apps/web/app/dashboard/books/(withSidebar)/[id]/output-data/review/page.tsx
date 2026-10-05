"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import { useOutputDataSaveBar } from "@/components/dashboard/OutputDataSaveBar";
import { getChangesSummary } from "@/components/books/RepublishButton";
import { Card } from "@/components/ui/card";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { DISTRIBUTION_PLATFORMS } from "@/lib/distributionPlatforms";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import {
  resolveBookPrintFormat,
  isPublishStepComplete,
  isPublishFieldComplete,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from "shared-types";

interface BookAuthor {
  lastName: string;
  firstName: string;
  middleName?: string;
  photoUrl?: string;
}

interface ReviewBook {
  status?: string | null;
  title: string;
  genre?: string | null;
  language: string;
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printPageCount?: number | null;
  pageCount?: number | null;
  originalDocxUrl?: string | null;
  coverUrl?: string | null;
  printPdfUrl?: string | null;
  description?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
  bookAuthors?: BookAuthor[] | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  desiredRoyaltyAmountPrint?: number | string | null;
  distributionChannels?: string[] | null;
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  republishRequestedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  pendingCoverUrl?: string | null;
}

interface IsbnChecklistItem {
  label: string;
  done: boolean;
  hint?: string;
  linkHref?: string;
  linkLabel?: string;
}

function IsbnReadinessChecklist({ book, bookId }: { book: ReviewBook | null; bookId: string }) {
  // ISBN is self-service (видавець сам призначає з власного блоку номерів,
  // жодного зовнішнього подання не потребує) -- this checklist is actually
  // about readiness for УДК + авторський знак ("шифр зберігання"), the one
  // that DOES need an external request to Книжкова палата. Gated on
  // udcCode, not isbn -- a book can already have its ISBN self-assigned and
  // still very much need УДК.
  if (book?.udcCode) {
    return (
      <Card className="p-5 text-sm">
        <p className="flex items-center gap-2 text-gray-700">
          <span className="text-green-600">✓</span>
          УДК вже присвоєно — реєстрація в Книжковій палаті не потрібна.
        </p>
      </Card>
    );
  }

  const bookAuthors = Array.isArray(book?.bookAuthors) ? book!.bookAuthors! : [];
  const hasAuthorName = bookAuthors.some((a) => a.lastName.trim() && a.firstName.trim());
  const descLength = (book?.description ?? "").trim().length;
  const annotationOk = isPublishFieldComplete("description", book ?? {});

  const items: IsbnChecklistItem[] = [
    {
      label: `Анотація (файл 1 для заявки на УДК) — ${DESCRIPTION_MIN_LENGTH}–${DESCRIPTION_MAX_LENGTH} символів`,
      done: annotationOk,
      hint: !annotationOk
        ? descLength === 0
          ? "Анотація ще не заповнена"
          : descLength < DESCRIPTION_MIN_LENGTH
            ? `${descLength} символів — потрібно щонайменше ${DESCRIPTION_MIN_LENGTH}`
            : `${descLength} символів — забагато, максимум ${DESCRIPTION_MAX_LENGTH}`
        : undefined,
    },
    {
      label: "Повне ПІБ автора (файл 1 для заявки на УДК)",
      done: hasAuthorName,
      hint: !hasAuthorName ? "Додайте прізвище та ім'я автора на вкладці «Вихідні дані»" : undefined,
    },
    { label: "Обкладинка завантажена", done: !!book?.coverUrl },
    {
      label: "PDF для друку рукопису (файл 2 для заявки на УДК)",
      done: !!book?.printPdfUrl,
      hint: !book?.printPdfUrl ? "Ще не згенеровано — натисніть посилання нижче, щоб створити" : undefined,
      linkHref: !book?.printPdfUrl ? `/dashboard/books/${bookId}/manuscript/preview` : undefined,
      linkLabel: "Відкрити «Передперегляд книги» (згенерує його) →",
    },
  ];
  const doneCount = items.filter((it) => it.done).length;

  return (
    <Card className="p-5 text-sm">
      <CollapsibleSection
        title={`Готовність до реєстрації УДК · ${doneCount} з ${items.length}`}
        description="Перевірка інформації, яку потрібно надати Книжковій палаті для заявки на УДК + авторський знак. ISBN сюди не входить — видавець призначає його сам, зі свого блоку номерів."
        defaultOpen={doneCount < items.length}
      >
      <div className="space-y-3">
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2">
            <span className={cn("mt-0.5", it.done ? "text-green-600" : "text-amber-500")}>
              {it.done ? "✓" : "○"}
            </span>
            <span className={it.done ? "text-gray-700" : "text-gray-500"}>
              {it.label}
              {it.hint && <span className="block text-xs text-amber-600">{it.hint}</span>}
              {it.linkHref && (
                <Link href={it.linkHref} className="block text-xs text-blue-600 underline hover:no-underline">
                  {it.linkLabel}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-400 border-t pt-2">
        Структуру друкованого файлу (титул → порожня сторінка → текст, файл 2 для заявки на УДК) платформа формує
        автоматично в межах PDF для друку вище — окремо готувати цю структуру не потрібно.
      </p>
      </div>
      </CollapsibleSection>
    </Card>
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

// Read-only summary card for one output-data section -- WF-SPEC "07 Огляд"
// п.1: each card links back to the page it summarizes via "Змінити", and
// gets an amber border + "Змінено · на модерацію" tag while this section
// has an unresolved content change pending moderation (changedBlocks is the
// SAME list the dashboard's header button/banner use, via
// getChangesSummary() -- one source of truth for "what's pending").
function SectionCard({
  title,
  editHref,
  changed,
  children,
}: {
  title: string;
  editHref: string;
  changed: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5 shadow-none", changed ? "border-2 border-amber-400 bg-amber-50/30" : "bg-gray-50")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {changed && (
            <Badge className="rounded-full border-amber-300 bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-800 hover:bg-amber-100">
              Змінено · на модерацію
            </Badge>
          )}
          <Link href={editHref} className="text-xs font-medium text-gray-600 underline hover:no-underline">
            Змінити
          </Link>
        </div>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </Card>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function OutputDataReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { book, loading } = useBook<ReviewBook>(id);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  return <OutputDataReviewForm key={id} book={book} bookId={id} />;
}

function OutputDataReviewForm({ book, bookId: id }: { book: ReviewBook | null; bookId: string }) {
  const { apiFetch } = useApi();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [republishRequestedAt, setRepublishRequestedAt] = useState(book?.republishRequestedAt ?? null);

  const infoSectionDone = isPublishStepComplete("info", book ?? {});
  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const coverSectionDone = isPublishStepComplete("cover", book ?? {});
  const priceSectionDone = isPublishStepComplete("price", book ?? {});
  const readyToPublish = infoSectionDone && fileSectionDone && coverSectionDone && priceSectionDone;

  // Persisted format, matches price/page.tsx's own derivation.
  const displayFormat = resolveBookPrintFormat(book ?? {});

  const isPublished = book?.status === "PUBLISHED" || book?.status === "UNPUBLISHED";
  const { hasChanges, blocks: changedBlocks } = getChangesSummary({
    docxUpdatedAt: book?.docxUpdatedAt,
    publishedAt: book?.publishedAt,
    pendingTitle: book?.pendingTitle,
    pendingDescription: book?.pendingDescription,
    pendingGenre: book?.pendingGenre,
    pendingCoverUrl: book?.pendingCoverUrl,
  });
  const infoChanged = changedBlocks.includes("Вихідні дані");
  const coverChanged = changedBlocks.includes("Обкладинка");
  const manuscriptChanged = changedBlocks.includes("Рукопис");
  const isPending = !!republishRequestedAt;

  async function submitForModeration() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const { book: updated } = await apiFetch<{ book: { republishRequestedAt: string } }>(
        `/api/books/${id}/republish`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setRepublishRequestedAt(updated.republishRequestedAt);
    } catch (e: any) {
      setSubmitError(e.message || "Помилка надсилання змін");
    } finally {
      setSubmitting(false);
    }
  }

  // WF-SPEC "07 Огляд" п.5/6 -- CTA only for a published book with
  // unresolved content changes; "✓ Усі зміни опубліковано" once nothing's
  // pending, "⏳ На модерації" while a submitted request is still in flight.
  // An unpublished book already has PublishButton/output-data's own submit
  // flow elsewhere -- this page's bar stays silent for it (no CTA here).
  useOutputDataSaveBar(
    !isPublished
      ? { dirty: false }
      : isPending
        ? {
            dirty: false,
            statusKey: "pending",
            statusNote: <span className="text-sm font-medium text-amber-700">⏳ Зміни на модерації</span>,
          }
        : hasChanges
          ? {
              dirty: true,
              saving: submitting,
              onSave: submitForModeration,
              saveLabel: `Надіслати на модерацію (${changedBlocks.length})`,
              statusKey: `error:${submitError}`,
              statusNote: submitError ? <span className="text-sm text-red-600">{submitError}</span> : undefined,
            }
          : {
              dirty: false,
              statusKey: "published",
              statusNote: <span className="text-sm font-medium text-green-700">✓ Усі зміни опубліковано</span>,
            }
  );

  // WF-SPEC п.3 -- ULIT завжди активний (locked-канал), навіть якщо
  // book.distributionChannels (лише зовнішні магазини) його не містить.
  const channelKeys = Array.from(new Set(["ULIT", ...(book?.distributionChannels ?? [])]));
  const channelNames = channelKeys
    .map((k) => DISTRIBUTION_PLATFORMS.find((p) => p.key === k)?.name ?? k)
    .filter(Boolean);

  // WF-SPEC п.2 -- одна таблиця Варіант/Ціна/Прибуток/Магазин. Прибуток у
  // ULIT = саме той гонорар, який автор встановив на "Ціні" (не діапазон
  // по зовнішніх платформах -- той розрахунок лишається на самій "Ціні").
  const priceRows = [
    { label: "Е-книга", price: book?.priceEbook, profit: book?.desiredRoyaltyAmount },
    { label: "Друк, м'яка (кольор.)", price: book?.pricePrint, profit: book?.desiredRoyaltyAmountPrint },
    { label: "Друк, тверда (кольор.)", price: book?.pricePrintHardcover, profit: book?.desiredRoyaltyAmountPrint },
    { label: "Друк, м'яка (ч/б)", price: book?.pricePrintBw, profit: book?.desiredRoyaltyAmountPrint },
    { label: "Друк, тверда (ч/б)", price: book?.pricePrintHardcoverBw, profit: book?.desiredRoyaltyAmountPrint },
  ].filter((r) => r.price);

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.review} done={readyToPublish} />
      <div className="space-y-4">
        <SectionCard title="Вихідні дані" editHref={`/dashboard/books/${id}/output-data`} changed={infoChanged}>
          <Row label="Назва" value={book?.title || "—"} />
          <Row label="Жанр" value={book?.genre || "—"} />
          <Row label="Розмір книги" value={`${displayFormat.label} (${displayFormat.widthMm}×${displayFormat.heightMm}мм)`} />
          <Row
            label="Кількість сторінок"
            value={book?.printPageCount ?? book?.pageCount ? `${book?.printPageCount ?? book?.pageCount} ст.` : "—"}
          />
          {book?.isbn && <Row label="ISBN" value={book.isbn} />}
        </SectionCard>

        <SectionCard title="Рукопис" editHref={`/dashboard/books/${id}/output-data/file`} changed={manuscriptChanged}>
          <Row label="Файл" value={book?.originalDocxUrl ? "Завантажено" : "Не завантажено"} />
        </SectionCard>

        <SectionCard title="Обкладинка" editHref={`/dashboard/books/${id}/output-data/cover`} changed={coverChanged}>
          <Row label="Обкладинка" value={book?.coverUrl ? "Завантажено" : "Не завантажено"} />
        </SectionCard>

        <SectionCard title="Ціна та розповсюдження" editHref={`/dashboard/books/${id}/output-data/price`} changed={false}>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Платформи: {channelKeys.length} обрано</span>
            <Link
              href={`/dashboard/books/${id}/output-data/price`}
              className="text-xs font-medium text-gray-600 underline hover:no-underline"
            >
              Додати магазини
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channelNames.map((name) => (
              <Badge key={name} variant="outline" className="rounded-full border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                {name}
              </Badge>
            ))}
          </div>
          {isPublished && (
            <Badge className="rounded-full border-green-300 bg-green-50 px-2 py-0.5 text-[0.6875rem] font-medium text-green-700 hover:bg-green-50">
              Застосовано одразу
            </Badge>
          )}
        </SectionCard>

        {priceRows.length > 0 && (
          <Card className="overflow-hidden p-0 shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5">Варіант</th>
                  <th className="px-4 py-2.5">Ціна для читача</th>
                  <th className="px-4 py-2.5">Ваш прибуток</th>
                  <th className="px-4 py-2.5">Магазин</th>
                </tr>
              </thead>
              <tbody>
                {priceRows.map((r) => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.label}</td>
                    <td className="px-4 py-2.5">{round2(Number(r.price)).toFixed(2)} грн</td>
                    <td className="px-4 py-2.5">{r.profit ? `${round2(Number(r.profit)).toFixed(2)} грн` : "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">ULIT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {book?.pricePrint || book?.pricePrintHardcover || book?.pricePrintBw || book?.pricePrintHardcoverBw ? (
          <IsbnReadinessChecklist book={book} bookId={id} />
        ) : null}
      </div>
    </div>
  );
}
