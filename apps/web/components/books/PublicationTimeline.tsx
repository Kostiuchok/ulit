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
}: {
  done: boolean;
  active?: boolean;
  label: React.ReactNode;
  date?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          done ? "bg-green-100 text-green-700" : active ? "border-2 border-gray-900" : "bg-gray-100 text-gray-300"
        )}
      >
        {done ? "✓" : ""}
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className={cn("text-sm", done ? "font-medium text-gray-900" : active ? "font-medium text-gray-700" : "text-gray-400")}>
          {label}
        </span>
        {date && <span className="text-xs text-gray-400 shrink-0">{fmt(date)}</span>}
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
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Статус публікації</h2>
      <div className="divide-y">
        <Row done label="Книга створена" date={createdAt} />
        {STEPS.map((step, i) => (
          <Row
            key={step.key}
            done={!!timeline?.[step.key]}
            active={firstPendingIdx === i + 1}
            label={step.label}
            date={timeline?.[step.key]}
          />
        ))}
        <Row
          done={publishedDone}
          active={firstPendingIdx === STEPS.length + 1}
          label={isbn ? `Публікація у магазинах / ISBN: ${isbn}` : "Публікація у магазинах"}
        />
      </div>

      {publishedDone && (
        <div className="mt-3 pt-3 border-t space-y-1.5">
          <p className="text-xs font-medium text-gray-500 mb-1">Дата оновлення статистики продажів</p>
          {CHANNELS.filter((c) => distributionChannels.includes(c.key)).map((c) => {
            const st = channelByKey[c.key];
            const ok = st.status === "SENT" || st.status === "PUBLISHED";
            return (
              <div key={c.key} className="flex items-center gap-2 text-xs">
                <span className={ok ? "text-green-600" : "text-gray-300"}>{ok ? "✓" : "✕"}</span>
                <span className="text-gray-600">{c.name}</span>
                {st.sentAt && <span className="text-gray-400">/ поновлено {fmt(st.sentAt)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
