"use client";

import { cn } from "../../lib/utils";

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

interface Props {
  createdAt: string;
  timeline?: Record<string, string> | null;
  isbn?: string | null;
  bookStatus: string;
  distributionChannels: string[];
  d2d: ChannelStatus;
  kdp: ChannelStatus;
  google: ChannelStatus;
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
}: {
  done: boolean;
  active?: boolean;
  label: React.ReactNode;
  date?: string | null;
  tooltip?: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex items-start gap-3 pb-5">
      {!isLast && (
        <div
          className="absolute left-[9px] top-5 bottom-0 w-px"
          style={{ backgroundColor: done ? ACCENT : "#e5e5e5" }}
        />
      )}
      <div
        className={cn("relative z-10 mt-0.5 flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-white text-[0.6875rem] font-bold")}
        style={done ? { color: ACCENT } : active ? { border: "2px solid #111" } : { border: "1px solid #d4d4d4", color: "#c4c4c4" }}
      >
        {done ? "✓" : ""}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn("text-sm", done ? "font-bold" : active ? "font-bold text-black" : "text-gray-400")}
            style={done ? { color: ACCENT } : undefined}
          >
            {label}
          </span>
          {date && <span className="text-sm text-gray-500 shrink-0">/ {fmt(date)}</span>}
        </div>
        {tooltip && active && (
          <div className="relative mt-2 inline-flex max-w-xs items-start gap-1.5 rounded-md bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
            <span>📖</span>
            <span>
              Ми надамо книзі <span style={{ color: ACCENT }}>безкоштовний ISBN</span> і відправимо до книжкової палати України
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PublicationTimeline({
  createdAt,
  timeline,
  isbn,
  bookStatus,
  distributionChannels,
  d2d,
  kdp,
  google,
}: Props) {
  const publishedDone = bookStatus === "PUBLISHED" && !!isbn;
  const doneFlags = [true, ...STEPS.map((s) => !!timeline?.[s.key]), publishedDone];
  const firstPendingIdx = doneFlags.findIndex((d) => !d);

  const channelByKey: Record<string, ChannelStatus> = { D2D: d2d, KDP: kdp, GOOGLE: google };

  return (
    <div>
      <Row done label="Книга створена" date={createdAt} />
      {STEPS.map((step, i) => (
        <Row
          key={step.key}
          done={!!timeline?.[step.key]}
          active={firstPendingIdx === i + 1}
          label={step.label}
          date={timeline?.[step.key]}
          tooltip={step.key === "submitted" ? "isbn" : undefined}
        />
      ))}
      <Row
        done={publishedDone}
        active={firstPendingIdx === STEPS.length + 1}
        label={isbn ? `Публікація у магазинах / ISBN: ${isbn}` : "Публікація у магазинах"}
        isLast={!publishedDone}
      />

      {publishedDone && (
        <div className="ml-7 mt-1 space-y-1.5">
          <p className="text-sm font-bold text-black">Дата оновлення статистики продажів на зовнішніх майданчиках</p>
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
  );
}
