"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { Card } from "@/components/ui/card";
import { useBook } from "@/hooks/useBook";
import { DISTRIBUTION_PLATFORMS } from "@/lib/distributionPlatforms";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import {
  PRINT_FORMATS,
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
  distributionChannels?: string[] | null;
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
      hint: !hasAuthorName ? "Додайте прізвище та ім'я автора на вкладці «Інформація»" : undefined,
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

  return (
    <Card className="p-5 space-y-3 text-sm">
      <div>
        <h2 className="text-base font-semibold">Готовність до реєстрації УДК</h2>
        <p className="text-xs text-gray-500">
          Перевірка інформації, яку потрібно надати Книжковій палаті для заявки на УДК + авторський знак —
          детальніше в <code className="text-xs">docs/isbn-udc-requirements.md</code>. ISBN сюди не входить —
          видавець призначає його сам, зі свого блоку номерів.
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

export default function OutputDataReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { book, loading } = useBook<ReviewBook>(id);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const infoSectionDone = isPublishStepComplete("info", book ?? {});
  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const coverSectionDone = isPublishStepComplete("cover", book ?? {});
  const priceSectionDone = isPublishStepComplete("price", book ?? {});
  const readyToPublish = infoSectionDone && fileSectionDone && coverSectionDone && priceSectionDone;

  // Persisted format, matches price/page.tsx's own derivation.
  const displayFormat = resolveBookPrintFormat(book ?? {});

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.review} done={readyToPublish} />
      <div className="space-y-6">
        <Card className="bg-gray-50 p-5 space-y-3 text-sm shadow-none">
          <Row label="Назва" value={book?.title || "—"} />
          {book?.isbn && <Row label="ISBN" value={book.isbn} />}
          <Row label="Жанр" value={book?.genre || "—"} />
          <Row label="Розмір книги" value={`${displayFormat.label} (${displayFormat.widthMm}×${displayFormat.heightMm}мм)`} />
          <Row
            label="Кількість сторінок"
            value={book?.printPageCount ?? book?.pageCount ? `${book?.printPageCount ?? book?.pageCount} ст.` : "—"}
          />
          <Row label="Рукопис" value={book?.originalDocxUrl ? "Завантажено" : "Не завантажено"} />
          <Row label="Обкладинка" value={book?.coverUrl ? "Завантажено" : "Не завантажено"} />
          <Row label="Е-книга" value={book?.priceEbook ? `${Number(book.priceEbook).toFixed(2)} грн` : "Не продається"} />
          <Row label="Друк, м'яка (кольор.)" value={book?.pricePrint ? `${Number(book.pricePrint).toFixed(2)} грн` : "Не продається"} />
          <Row label="Друк, тверда (кольор.)" value={book?.pricePrintHardcover ? `${Number(book.pricePrintHardcover).toFixed(2)} грн` : "Не продається"} />
          <Row label="Друк, м'яка (ч/б)" value={book?.pricePrintBw ? `${Number(book.pricePrintBw).toFixed(2)} грн` : "Не продається"} />
          <Row label="Друк, тверда (ч/б)" value={book?.pricePrintHardcoverBw ? `${Number(book.pricePrintHardcoverBw).toFixed(2)} грн` : "Не продається"} />
          <Row label="Платформи" value={book?.distributionChannels?.length ? `${book.distributionChannels.length} обрано` : "Не обрано"} />
        </Card>

        {book?.pricePrint || book?.pricePrintHardcover || book?.pricePrintBw || book?.pricePrintHardcoverBw ? (
          <IsbnReadinessChecklist book={book} bookId={id} />
        ) : null}

        {!!book?.distributionChannels?.length && (
          <Card className="p-5 space-y-4 text-sm">
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
          </Card>
        )}
      </div>
    </div>
  );
}
