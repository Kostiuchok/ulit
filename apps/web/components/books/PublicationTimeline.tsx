"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { getBookStatusLabel } from "../../lib/bookStatus";

// Only "submitted"/"review_done" drive the active-step highlighting below —
// the contract is now signed once, author-wide, before a book can even be
// submitted (see /dashboard/settings/contract), so "Укладання договору" is
// rendered as its own always-done group (see CONTRACT_SUB_STEPS) rather than
// a step the author waits on per book.
const STEPS = [
  { key: "submitted", label: "Надішліть книгу на публікацію" },
  { key: "review_done", label: "Перевірка завершена" },
] as const;

// Nested under the "Укладання договору" group — only shown when the admin has
// actually initiated one of these for this specific book (document re-check
// or updated terms), not as steps the author waits through by default.
const CONTRACT_SUB_STEPS = [
  { key: "contract_corrected", label: "Договір виправлено" },
  { key: "review_2", label: "Повторна перевірка документів" },
] as const;

const CHANNELS = [
  { key: "D2D", name: "Draft2Digital" },
  { key: "KDP", name: "Amazon KDP" },
  { key: "GOOGLE", name: "Google Play Books" },
] as const;

const ACCENT = "#50a406";

interface ChannelStatus {
  status: string;
  sentAt?: string | null;
}

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
  distributionStrategy?: string;
  kdpSelectEnrolled?: boolean;
  kdpSelectExpiry?: string | null;
  d2d: ChannelStatus;
  kdp: ChannelStatus;
  google: ChannelStatus;
  creation: CreationInfo;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

function Row({
  done,
  active,
  label,
  date,
  tooltip,
  isLast,
  hideLine,
  toggle,
}: {
  done: boolean;
  active?: boolean;
  label: React.ReactNode;
  date?: string | null;
  tooltip?: React.ReactNode;
  isLast?: boolean;
  hideLine?: boolean;
  toggle?: { expanded: boolean; onClick: () => void };
}) {
  return (
    <div className="group/row relative flex items-start gap-3 pb-5">
      {!isLast && !hideLine && (
        <div
          className="absolute left-[9px] top-5 bottom-0 w-px"
          style={{ backgroundColor: done ? ACCENT : "#e5e5e5" }}
        />
      )}
      <div
        className="relative z-10 mt-0.5 flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold"
        style={
          done
            ? { backgroundColor: ACCENT, color: "#fff" }
            : active
            ? { backgroundColor: "#fff", border: "2px solid #111" }
            : { backgroundColor: "#fff", border: "1px solid #d4d4d4", color: "#c4c4c4" }
        }
      >
        {done ? "✓" : ""}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2">
          <span
            className={cn("text-sm", done ? "font-bold" : active ? "font-bold text-black" : "text-gray-400")}
            style={done ? { color: ACCENT } : undefined}
          >
            {label}
          </span>
          {tooltip && (
            <span className="relative inline-flex shrink-0 items-center">
              <Info size={14} className="text-gray-400" />
              <div className="absolute left-0 top-full z-20 mt-2 hidden w-72 items-start gap-1.5 rounded-md bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] group-hover/row:flex sm:left-full sm:top-1/2 sm:mt-0 sm:ml-2 sm:-translate-y-1/2">
                <span>📖</span>
                <span>{tooltip}</span>
              </div>
            </span>
          )}
          {date && <span className="text-sm text-gray-500 shrink-0">/ {fmt(date)}</span>}
          {toggle && (
            <button type="button" onClick={toggle.onClick} title={toggle.expanded ? "Згорнути" : "Розгорнути"}>
              <img
                src="/figma/chevron-collapse.svg"
                alt=""
                className={cn("h-2.5 w-3.5 transition-transform", toggle.expanded ? "rotate-180" : "rotate-90")}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreationSubItem({
  done,
  label,
  href,
  date,
  tooltip,
}: {
  done: boolean;
  label: string;
  href?: string;
  date?: string | null;
  tooltip?: React.ReactNode;
}) {
  const inner = (
    <div className="group/subitem relative flex items-center gap-1.5 text-sm">
      <span style={done ? { color: ACCENT } : undefined} className={!done ? "text-gray-300" : undefined}>
        {done ? "✓" : "○"}
      </span>
      <span style={done ? { color: ACCENT } : undefined} className={cn(!done && (href ? "text-black underline" : "text-gray-400"))}>
        {label}
      </span>
      {date && <span className="text-gray-500">/ {fmt(date)}</span>}
      {tooltip && (
        <span className="relative inline-flex shrink-0 items-center">
          <Info size={13} className="text-gray-400" />
          <div className="absolute left-0 top-full z-20 mt-2 hidden w-72 items-start gap-1.5 rounded-md bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] group-hover/subitem:flex sm:left-full sm:top-1/2 sm:mt-0 sm:ml-2 sm:-translate-y-1/2">
            <span>{tooltip}</span>
          </div>
        </span>
      )}
    </div>
  );
  return href && !done ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function PublicationTimeline({
  bookId,
  createdAt,
  timeline,
  contractAcceptedAt,
  isbn,
  bookStatus,
  distributionChannels,
  distributionStrategy,
  kdpSelectEnrolled,
  kdpSelectExpiry,
  d2d,
  kdp,
  google,
  creation,
}: Props) {
  const [creationExpanded, setCreationExpanded] = useState(true);
  const [submittedExpanded, setSubmittedExpanded] = useState(true);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const hasBasicInfo = !!(creation.title && creation.genre);
  const hasManuscript = !!creation.originalDocxUrl;
  const manuscriptDate = creation.manuscriptEditedAt ?? creation.manuscriptImportedAt;
  const hasPrice = !!(creation.priceEbook || creation.pricePrint || creation.pricePrintHardcover);
  const hasPrintPrice = !!(creation.pricePrint || creation.pricePrintHardcover);
  const hasCover = !!creation.coverUrl;
  // printPdfUrl is only generated when the author opens the manuscript's
  // "Друкований PDF" link (print-preview.ts) -- nothing else in the publish flow
  // creates it (T-2057). Admin's own isIsbnReady() requires it too, so a
  // book missing it will never appear in the admin's УДК queue no matter
  // how "ready" everything else looks -- the author needs a visible reason
  // to know THEY are the blocker, not silently waiting on the admin. Note:
  // ISBN itself is self-service (видавець сам призначає з власного блоку) --
  // it's УДК + авторський знак that actually needs this whole queue/e-mail
  // process, hence "udkBlockedOnAuthor" below, not an ISBN one.
  const hasPrintPdf = !!creation.printPdfUrl;
  const udkBlockedOnAuthor = hasPrintPrice && !hasPrintPdf;
  const hasDistribution = distributionChannels.length > 0;
  const outputDataFilled = hasBasicInfo && hasPrice;
  const isSubmitted = bookStatus !== "DRAFT" && bookStatus !== "PROCESSING";
  const publishedDone = (bookStatus === "PUBLISHED" || bookStatus === "UNPUBLISHED") && !!isbn;
  const doneFlags = [true, ...STEPS.map((s) => !!timeline?.[s.key]), publishedDone];
  const firstPendingIdx = doneFlags.findIndex((d) => !d);

  const channelByKey: Record<string, ChannelStatus> = { D2D: d2d, KDP: kdp, GOOGLE: google };

  const statusLabel = getBookStatusLabel(bookStatus, timeline).label;

  const kdpExpiryDate = kdpSelectExpiry ? new Date(kdpSelectExpiry) : null;
  const kdpActive = !!kdpSelectEnrolled && !!kdpExpiryDate && kdpExpiryDate > new Date();
  const strategyTooltip = kdpActive ? (
    <>
      Книга ексклюзивна на <span style={{ color: ACCENT }}>Amazon KDP</span> (KDP Select)
      {kdpExpiryDate ? <> до {fmt(kdpExpiryDate.toISOString())}</> : null} — Draft2Digital і Google Play Books
      недоступні до завершення терміну.
    </>
  ) : (
    <>
      Книга доступна одночасно на <span style={{ color: ACCENT }}>Draft2Digital</span>,{" "}
      <span style={{ color: ACCENT }}>Amazon KDP</span> та <span style={{ color: ACCENT }}>Google Play Books</span>.
    </>
  );

  return (
    <div>
      <p className="mb-4 text-sm font-bold uppercase text-black">Статус книжки: {statusLabel}</p>
      <div className="relative">
        <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ backgroundColor: ACCENT }} />
        <Row
          done
          label="Книга створена"
          date={createdAt}
          hideLine
          toggle={{ expanded: creationExpanded, onClick: () => setCreationExpanded((v) => !v) }}
        />
        {creationExpanded && (
          <div className="ml-7 mb-4 -mt-3 space-y-1.5">
            <CreationSubItem
              done={hasBasicInfo}
              label="Основна інформація про книгу"
              href={`/dashboard/books/${bookId}/output-data`}
            />
            <CreationSubItem
              done={hasManuscript}
              label="Завантажити рукопис"
              href={`/dashboard/books/${bookId}/manuscript`}
              date={hasManuscript ? manuscriptDate : undefined}
            />
            <CreationSubItem
              done={hasPrice}
              label="Ціна"
              href={`/dashboard/books/${bookId}/output-data`}
            />
            <CreationSubItem
              done={hasCover}
              label="Додати обкладинку"
              href={`/dashboard/books/${bookId}/cover`}
            />
            <CreationSubItem
              done={hasDistribution}
              label="Платформи розповсюдження"
              href={`/dashboard/books/${bookId}/output-data`}
            />
            <CreationSubItem done={isSubmitted} label="Огляд та публікація" />
            {/* ISBN itself needs none of this -- self-service, видавець сам
                призначає з власного блоку номерів. This step tracks УДК +
                авторський знак ("шифр зберігання"), the credential that
                actually requires an external request/wait. */}
            <CreationSubItem
              done={!!creation.udcCode}
              label="Отримати УДК"
              href={udkBlockedOnAuthor ? `/dashboard/books/${bookId}/manuscript/preview` : undefined}
              tooltip={
                udkBlockedOnAuthor
                  ? "⚠ Очікування УДК ще не почалось: не згенеровано друкований PDF рукопису. Натисніть, щоб відкрити «Друкований PDF» — це й запустить генерацію."
                  : "Адмін надіслав заявку до Книжкової палати — термін відповіді залежить від обраної терміновості послуги."
              }
            />
          </div>
        )}
      </div>
      {STEPS.map((step, i) => {
        const isSubmittedStep = step.key === "submitted";
        const stepDone = !!timeline?.[step.key];
        const stepActive = firstPendingIdx === i + 1;
        return (
          <div key={step.key} className="relative">
            {isSubmittedStep && (
              <div
                className="absolute left-[9px] top-5 bottom-0 w-px"
                style={{ backgroundColor: stepDone ? ACCENT : "#e5e5e5" }}
              />
            )}
            <Row
              done={stepDone}
              active={stepActive}
              label={step.label}
              date={timeline?.[step.key]}
              hideLine={isSubmittedStep}
              tooltip={
                isSubmittedStep ? (
                  <>
                    Ми присвоїмо книзі <span style={{ color: ACCENT }}>безкоштовний ISBN</span> і подамо заявку на
                    УДК до Книжкової палати України
                    {hasPrintPrice && (
                      <>
                        {" "}
                        Для друкованого видання надання обов&apos;язкових примірників (2 шт) до Книжкової палати —{" "}
                        <strong>обов&apos;язкове за законом</strong>. Ці примірники друкуються{" "}
                        <strong>за рахунок автора</strong> — надішлете їх нам після виходу книги з друку.
                      </>
                    )}
                  </>
                ) : undefined
              }
              toggle={
                isSubmittedStep
                  ? { expanded: submittedExpanded, onClick: () => setSubmittedExpanded((v) => !v) }
                  : undefined
              }
            />
            {isSubmittedStep && submittedExpanded && (
              <div className="ml-7 mb-4 -mt-3 space-y-1.5">
                <CreationSubItem done={outputDataFilled} label="Вихідні дані заповнені" />
                <CreationSubItem done={hasDistribution} label="Магазини та розмір роялті обрані" />
              </div>
            )}
          </div>
        );
      })}
      {!!timeline?.review_done && (
        <div className="relative">
          <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ backgroundColor: ACCENT }} />
          <Row
            done={!!contractAcceptedAt}
            label={
              <Link
                href="/dashboard/settings/contract"
                className="inline-flex items-center gap-1.5 underline hover:no-underline"
                style={contractAcceptedAt ? { color: ACCENT } : undefined}
              >
                <FileText size={14} />
                Укладання договору
              </Link>
            }
            date={contractAcceptedAt}
            hideLine
          />
          {(!!timeline?.contract_corrected || !!timeline?.review_2) && (
            <div className="ml-7 mb-4 -mt-3 space-y-1.5">
              {CONTRACT_SUB_STEPS.filter((s) => !!timeline?.[s.key]).map((s) => (
                <CreationSubItem key={s.key} done label={s.label} date={timeline?.[s.key]} />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        {publishedDone && (
          <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ backgroundColor: ACCENT }} />
        )}
        <Row
          done={publishedDone}
          active={firstPendingIdx === STEPS.length + 1}
          label={
            <Link
              href={`/dashboard/books/${bookId}/publish`}
              className="inline-flex items-center gap-1.5 underline hover:no-underline"
              style={publishedDone ? { color: ACCENT } : undefined}
            >
              {isbn ? `Публікація у магазинах / ISBN: ${isbn}` : "Публікація у магазинах"}
            </Link>
          }
          isLast={!publishedDone}
          hideLine={publishedDone}
          tooltip={distributionStrategy ? strategyTooltip : undefined}
          toggle={
            publishedDone
              ? { expanded: channelsExpanded, onClick: () => setChannelsExpanded((v) => !v) }
              : undefined
          }
        />

        {publishedDone && channelsExpanded && (
          <div className="ml-7 mt-1 space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              <span style={{ color: ACCENT }}>✓</span>
              <span style={{ color: ACCENT }} className="font-medium">Ulit</span>
              {timeline?.contract_signed && <span className="text-black">/ опубліковано {fmt(timeline.contract_signed)}</span>}
            </div>
            {CHANNELS.filter((c) => distributionChannels.includes(c.key)).map((c) => {
              const st = channelByKey[c.key];
              const ok = st.status === "SENT" || st.status === "PUBLISHED";
              return (
                <div key={c.key} className="flex items-center gap-1.5 text-sm">
                  <span style={ok ? { color: ACCENT } : undefined} className={!ok ? "text-gray-300" : undefined}>
                    {ok ? "✓" : "✕"}
                  </span>
                  <span style={ok ? { color: ACCENT } : undefined}>{c.name}</span>
                  {st.sentAt && <span className="text-black">/ поновлено {fmt(st.sentAt)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
