"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { BOOK_STATUS_LABELS } from "../../lib/bookStatus";

const STEPS = [
  { key: "submitted", label: "Надішліть книгу на публікацію" },
  { key: "review_done", label: "Перевірка завершена" },
  { key: "contract_pending", label: "Укладіть договір" },
  { key: "contract_corrected", label: "Договір виправлено" },
  { key: "review_2", label: "Повторна перевірка документів" },
  { key: "contract_signed", label: "Договір укладено" },
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
}

interface Props {
  bookId: string;
  createdAt: string;
  timeline?: Record<string, string> | null;
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
        {tooltip && (
          <div className="absolute left-0 top-full z-20 mt-2 hidden w-72 items-start gap-1.5 rounded-md bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] group-hover/row:flex sm:left-full sm:top-0 sm:ml-3 sm:mt-0">
            <span>📖</span>
            <span>{tooltip}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CreationSubItem({
  done,
  label,
  href,
  date,
}: {
  done: boolean;
  label: string;
  href?: string;
  date?: string | null;
}) {
  const inner = (
    <div className="flex items-center gap-1.5 text-sm">
      <span style={done ? { color: ACCENT } : undefined} className={!done ? "text-gray-300" : undefined}>
        {done ? "✓" : "○"}
      </span>
      <span style={done ? { color: ACCENT } : undefined} className={cn(!done && (href ? "text-black underline" : "text-gray-400"))}>
        {label}
      </span>
      {date && <span className="text-gray-500">/ {fmt(date)}</span>}
    </div>
  );
  return href && !done ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function PublicationTimeline({
  bookId,
  createdAt,
  timeline,
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
  const hasCover = !!creation.coverUrl;
  const hasDistribution = distributionChannels.length > 0;
  const outputDataFilled = hasBasicInfo && hasPrice;
  const isSubmitted = bookStatus !== "DRAFT" && bookStatus !== "PROCESSING";
  const publishedDone = bookStatus === "PUBLISHED" && !!isbn;
  const doneFlags = [true, ...STEPS.map((s) => !!timeline?.[s.key]), publishedDone];
  const firstPendingIdx = doneFlags.findIndex((d) => !d);

  const channelByKey: Record<string, ChannelStatus> = { D2D: d2d, KDP: kdp, GOOGLE: google };

  const statusLabel = BOOK_STATUS_LABELS[bookStatus]?.label ?? bookStatus;

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
              label="Додано обкладинку"
              href={`/dashboard/books/${bookId}/cover`}
            />
            <CreationSubItem
              done={hasDistribution}
              label="Платформи розповсюдження"
              href={`/dashboard/books/${bookId}/output-data`}
            />
            <CreationSubItem done={isSubmitted} label="Огляд та публікація" />
          </div>
        )}
      </div>
      {STEPS.map((step, i) => {
        const isSubmittedStep = step.key === "submitted";
        const stepDone = !!timeline?.[step.key];
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
              active={firstPendingIdx === i + 1}
              label={step.label}
              date={timeline?.[step.key]}
              hideLine={isSubmittedStep}
              tooltip={
                isSubmittedStep ? (
                  <>
                    Ми надамо книзі <span style={{ color: ACCENT }}>безкоштовний ISBN</span> і відправимо до
                    книжкової палати України
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
      <div className="relative">
        {publishedDone && (
          <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ backgroundColor: ACCENT }} />
        )}
        <Row
          done={publishedDone}
          active={firstPendingIdx === STEPS.length + 1}
          label={isbn ? `Публікація у магазинах / ISBN: ${isbn}` : "Публікація у магазинах"}
          isLast={!publishedDone}
          hideLine={publishedDone}
          tooltip={distributionStrategy ? strategyTooltip : undefined}
        />

        {publishedDone && (
          <div className="ml-7 mt-1 space-y-1.5">
            <button
              type="button"
              onClick={() => setChannelsExpanded((v) => !v)}
              className="flex items-center gap-2 text-left text-sm font-bold text-black"
            >
              Дата оновлення статистики продажів на зовнішніх майданчиках
              <img
                src="/figma/chevron-collapse.svg"
                alt=""
                className={cn("h-2.5 w-3.5 shrink-0 transition-transform", channelsExpanded ? "rotate-180" : "rotate-90")}
              />
            </button>
            {channelsExpanded && CHANNELS.filter((c) => distributionChannels.includes(c.key)).map((c) => {
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
