"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../../../hooks/useApi";
import { Button } from "../../../../../components/ui/button";
import { cn } from "../../../../../lib/utils";

interface Book {
  id: string;
  title: string;
  description?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
  bbkCode?: string | null;
  authorSign?: string | null;
  bookChamberSubmittedAt?: string | null;
  coverUrl?: string | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  genre?: string | null;
  language?: string;
  pageCount?: number | null;
  distributionStrategy: string;
  distributionChannels?: string[];
  d2dStatus: string;
  d2dSentAt?: string | null;
  kdpStatus: string;
  kdpSentAt?: string | null;
  googleStatus: string;
  googleSentAt?: string | null;
  moderationStatus: string;
  moderationNote?: string | null;
  publicationTimeline?: Record<string, string> | null;
  createdAt: string;
  author: {
    name: string;
    email: string;
    taxId?: string | null;
    payoutDocument?: string | null;
    bankIban?: string | null;
    payoutDetailsSubmittedAt?: string | null;
  };
}

const TIMELINE_STEPS = [
  { key: "submitted", label: "Надішліть книгу на публікацію" },
  { key: "review_done", label: "Перевірка завершена" },
  { key: "contract_pending", label: "Укладіть договір" },
  { key: "contract_corrected", label: "Договір виправлено" },
  { key: "review_2", label: "Повторна перевірка документів" },
  { key: "contract_signed", label: "Договір укладено" },
] as const;

// Steps always visible in the main flow.
const MAIN_STEPS = TIMELINE_STEPS.filter((s) => s.key === "submitted" || s.key === "review_done");
// contract_pending/corrected/review_2/contract_signed are collapsed behind "Опублікувати
// книгу" in the common case (T-1951 — the author already signs the platform contract once,
// upfront, before a book can even be submitted, so admin no longer needs to manually walk
// through these one at a time). They stay available as an advanced/manual override for the
// rare re-verification case.
const ADVANCED_STEPS = TIMELINE_STEPS.filter((s) => s.key !== "submitted" && s.key !== "review_done");

const STATUS_OPTS = ["NOT_SENT", "SENT", "PUBLISHED", "ERROR"] as const;
const STATUS_COLORS: Record<string, string> = {
  NOT_SENT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ERROR: "bg-red-100 text-red-700",
};

const ACCENT = "#50a406";

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

function TimelineRow({
  done,
  active,
  label,
  right,
  children,
}: {
  done: boolean;
  active?: boolean;
  label: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ backgroundColor: done ? ACCENT : "#e5e5e5" }} />
      <div className="relative flex items-start gap-3 pb-4">
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
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap pt-0.5">
          <span
            className={`text-sm ${done ? "font-bold" : active ? "font-bold text-black" : "text-gray-400"}`}
            style={done ? { color: ACCENT } : undefined}
          >
            {label}
          </span>
          {right}
        </div>
      </div>
      {children && <div className="ml-7 -mt-2 pb-5">{children}</div>}
    </div>
  );
}

// ─── Platform requirements ────────────────────────────────────────────────────

type CheckResult = "pass" | "fail" | "warn";

interface Check {
  id: string;
  label: string;
  result: CheckResult;
  hint: string;
}

interface Platform {
  key: string;
  name: string;
  subtitle: string;
  checks: Check[];
}

function buildPlatforms(book: Book, coverW: number, coverH: number): Platform[] {
  const descLen = (book.description ?? "").length;
  const coverMaxDim = Math.max(coverW, coverH);
  const coverLoaded = coverW > 0;

  const check = (
    id: string,
    label: string,
    result: CheckResult,
    hint: string
  ): Check => ({ id, label, result, hint });

  const coverDimCheck = (minPx: number): Check => {
    if (!book.coverUrl) return check("cover", "Обкладинка", "fail", "Обкладинка відсутня");
    if (!coverLoaded)   return check("cover", `Обкладинка ≥ ${minPx}px`, "warn", "Розмір завантажується…");
    return check(
      "cover",
      `Обкладинка ≥ ${minPx}px (${coverMaxDim}px)`,
      coverMaxDim >= minPx ? "pass" : "fail",
      coverMaxDim >= minPx ? "" : `Обкладинка ${coverMaxDim}px — менше мінімуму ${minPx}px`
    );
  };

  return [
    {
      key: "kdp",
      name: "Amazon KDP",
      subtitle: "Kindle Direct Publishing",
      checks: [
        check("isbn", "ISBN", book.isbn ? "pass" : "fail",
          book.isbn ? "" : "ISBN обов'язковий для Amazon KDP"),
        check("epub_mobi", "EPUB або MOBI файл",
          (book.epubUrl || book.mobiUrl) ? "pass" : "fail",
          (book.epubUrl || book.mobiUrl) ? "" : "Потрібен EPUB або MOBI для завантаження"),
        check("desc", `Опис ≥ 250 символів (${descLen})`,
          descLen >= 250 ? "pass" : descLen >= 100 ? "warn" : "fail",
          descLen >= 250 ? "" : `Опис замалий (${descLen}/250 символів)`),
        coverDimCheck(1600),
        check("genre", "Жанр вказано", book.genre ? "pass" : "fail",
          book.genre ? "" : "Жанр обов'язковий для KDP"),
        check("pages", book.pageCount ? `Кількість сторінок (${book.pageCount})` : "Кількість сторінок",
          (book.pageCount ?? 0) > 0 ? "pass" : "warn",
          (book.pageCount ?? 0) > 0 ? "" : "Кількість сторінок не визначена — перевірте конвертацію"),
      ],
    },
    {
      key: "d2d",
      name: "Draft2Digital",
      subtitle: "Apple Books, B&N, Kobo, Scribd та ін.",
      checks: [
        check("epub", "EPUB файл", book.epubUrl ? "pass" : "fail",
          book.epubUrl ? "" : "D2D вимагає EPUB файл"),
        check("isbn", "ISBN", book.isbn ? "pass" : "warn",
          book.isbn ? "" : "ISBN бажаний, але не обов'язковий для D2D"),
        check("desc", `Опис ≥ 50 символів (${descLen})`,
          descLen >= 50 ? "pass" : "fail",
          descLen >= 50 ? "" : `Опис замалий (${descLen}/50 символів)`),
        check("cover", "Обкладинка", book.coverUrl ? "pass" : "fail",
          book.coverUrl ? "" : "Обкладинка обов'язкова для D2D"),
        check("price", "Ціна встановлена",
          (book.priceEbook || book.pricePrint || book.pricePrintHardcover) ? "pass" : "warn",
          (book.priceEbook || book.pricePrint || book.pricePrintHardcover) ? "" : "Ціна не встановлена"),
      ],
    },
    {
      key: "google",
      name: "Google Play Books",
      subtitle: "Google Books Partner Program",
      checks: [
        check("epub", "EPUB файл", book.epubUrl ? "pass" : "fail",
          book.epubUrl ? "" : "Google вимагає EPUB файл"),
        check("isbn", "ISBN", book.isbn ? "pass" : "fail",
          book.isbn ? "" : "ISBN обов'язковий для Google Play Books"),
        coverDimCheck(1400),
        check("desc", `Опис ≥ 150 символів (${descLen})`,
          descLen >= 150 ? "pass" : descLen >= 50 ? "warn" : "fail",
          descLen >= 150 ? "" : `Опис замалий (${descLen}/150 символів)`),
        check("lang", "Мова вказана", book.language ? "pass" : "fail",
          book.language ? "" : "Мова обов'язкова для Google"),
      ],
    },
  ];
}

function countIssues(platform: Platform) {
  return platform.checks.filter((c) => c.result !== "pass").length;
}

function buildRejectionText(platforms: Platform[]): string {
  const lines: string[] = ["Книга не відповідає вимогам платформ:\n"];
  for (const p of platforms) {
    const issues = p.checks.filter((c) => c.result !== "pass");
    if (issues.length === 0) continue;
    lines.push(`${p.name}:`);
    for (const c of issues) {
      const marker = c.result === "warn" ? "⚠" : "✕";
      lines.push(`  ${marker} ${c.hint || c.label}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckIcon({ result }: { result: CheckResult }) {
  if (result === "pass") return <span className="text-green-600 font-bold text-sm">✓</span>;
  if (result === "warn") return <span className="text-amber-500 font-bold text-sm">⚠</span>;
  return <span className="text-red-500 font-bold text-sm">✕</span>;
}

function PlatformSection({
  platform,
  defaultOpen,
}: {
  platform: Platform;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const issues = countIssues(platform);
  const fails = platform.checks.filter((c) => c.result === "fail").length;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{platform.name}</span>
          <span className="text-xs text-gray-400">{platform.subtitle}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {issues === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              ✓ Готово до відправки
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {fails > 0 ? `✕ ${fails} вимог не виконано` : `⚠ ${issues} увага`}
            </span>
          )}
          <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {platform.checks.map((c) => (
            <div
              key={c.id}
              className={`flex items-start gap-3 px-5 py-3 ${
                c.result === "pass"
                  ? "bg-white"
                  : c.result === "warn"
                  ? "bg-amber-50"
                  : "bg-red-50"
              }`}
            >
              <CheckIcon result={c.result} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  c.result === "pass" ? "text-gray-700" :
                  c.result === "warn" ? "text-amber-800" : "text-red-800"
                }`}>
                  {c.label}
                </p>
                {c.hint && (
                  <p className="text-xs text-gray-500 mt-0.5">{c.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceRow({
  name,
  subtitle,
  status,
  sentAt,
  saving,
  onChange,
}: {
  name: string;
  subtitle: string;
  status: string;
  sentAt?: string | null;
  saving: boolean;
  onChange: (status: string) => void;
}) {
  const ok = status === "SENT" || status === "PUBLISHED";
  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span style={ok ? { color: ACCENT } : undefined} className={!ok ? "text-gray-300" : undefined}>
          {ok ? "✓" : status === "ERROR" ? "✕" : "○"}
        </span>
        <span className="text-sm font-medium text-gray-800">{name}</span>
        <span className="text-xs text-gray-400">{subtitle}</span>
        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${STATUS_COLORS[status]}`}>{status}</span>
        {sentAt && <span className="text-xs text-gray-400">/ {fmtDate(sentAt)}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {STATUS_OPTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={saving || status === s}
            className={`rounded-md px-2.5 py-1 text-[0.6875rem] font-medium transition-colors disabled:opacity-50 ${
              status === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DistributePage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [d2d, setD2d] = useState("NOT_SENT");
  const [kdp, setKdp] = useState("NOT_SENT");
  const [google, setGoogle] = useState("NOT_SENT");
  const [coverDims, setCoverDims] = useState({ w: 0, h: 0 });
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectDone, setRejectDone] = useState(false);
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bcIsbn, setBcIsbn] = useState("");
  const [bcUdc, setBcUdc] = useState("");
  const [bcBbk, setBcBbk] = useState("");
  const [bcAuthorSign, setBcAuthorSign] = useState("");
  const [savingBookChamber, setSavingBookChamber] = useState(false);
  const [bookChamberError, setBookChamberError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: Book }>(`/api/admin/books/${id}`)
      .then(({ book: b }) => {
        setBook(b);
        setD2d(b.d2dStatus);
        setKdp(b.kdpStatus);
        setGoogle(b.googleStatus);
        setBcIsbn(b.isbn ?? "");
        setBcUdc(b.udcCode ?? "");
        setBcBbk(b.bbkCode ?? "");
        setBcAuthorSign(b.authorSign ?? "");
      })
      .finally(() => setLoading(false));
  }, [token, id]);

  // Load cover dimensions in background
  useEffect(() => {
    if (!book?.coverUrl) return;
    const img = new Image();
    img.onload = () => setCoverDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = book.coverUrl;
  }, [book?.coverUrl]);

  async function saveService(service: "d2d" | "kdp" | "google", status: string) {
    setSaving(service);
    try {
      const field = `${service}Status`;
      const sentAtField = `${service}SentAt`;
      const { book: updated } = await apiFetch<{ book: Book }>(
        `/api/admin/books/${id}/distribution`,
        {
          method: "PATCH",
          body: JSON.stringify({
            [field]: status,
            [sentAtField]: status === "SENT" ? new Date().toISOString() : null,
          }),
        }
      );
      setBook(updated);
      if (service === "d2d") setD2d(updated.d2dStatus);
      if (service === "kdp") setKdp(updated.kdpStatus);
      if (service === "google") setGoogle(updated.googleStatus);
    } finally {
      setSaving(null);
    }
  }

  async function saveTimelineStep(step: string, dateValue: string) {
    setSavingStep(step);
    try {
      const iso = dateValue ? new Date(dateValue).toISOString() : null;
      const { book: updated } = await apiFetch<{ book: Book }>(
        `/api/admin/books/${id}/publication-timeline`,
        { method: "PATCH", body: JSON.stringify({ step, date: iso }) }
      );
      setBook(updated);
    } finally {
      setSavingStep(null);
    }
  }

  async function saveBookChamber(patch: Record<string, string | null>) {
    setSavingBookChamber(true);
    setBookChamberError("");
    try {
      const { book: updated } = await apiFetch<{ book: Partial<Book> }>(
        `/api/admin/books/${id}/book-chamber`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setBook((b) => (b ? { ...b, ...updated } : b));
    } catch (e: any) {
      setBookChamberError(e.message || "Помилка збереження");
    } finally {
      setSavingBookChamber(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setRejecting(true);
    try {
      await apiFetch(`/api/admin/books/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectDone(true);
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400 p-8">Завантаження…</div>;
  }
  if (!book) return null;

  const isKdpSelect = book.distributionStrategy === "KDP_SELECT";
  const platforms = buildPlatforms(book, coverDims.w, coverDims.h);
  const totalIssues = platforms.reduce((s, p) => s + countIssues(p), 0);
  const totalFails = platforms.reduce(
    (s, p) => s + p.checks.filter((c) => c.result === "fail").length,
    0
  );

  function prefillRejection() {
    setRejectReason(buildRejectionText(platforms));
  }

  const doneFlags = [true, ...TIMELINE_STEPS.map((s) => !!book.publicationTimeline?.[s.key])];
  const firstPendingIdx = doneFlags.findIndex((d) => !d);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/books" className="text-sm text-gray-500 hover:text-gray-700">
          ← Книги
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{book.title}</h1>
      </div>

      {/* Book info */}
      <div className="rounded-xl border bg-white p-5 shadow-sm flex gap-4">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" className="h-28 w-20 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-28 w-20 rounded-lg bg-gray-100 flex items-center justify-center text-3xl shrink-0">📖</div>
        )}
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-gray-900">{book.title}</p>
          <p className="text-sm text-gray-500">Автор: {book.author.name} ({book.author.email})</p>
          {book.isbn && <p className="text-sm font-mono text-gray-700">ISBN: {book.isbn}</p>}
          {book.genre && <p className="text-sm text-gray-500">Жанр: {book.genre}</p>}
          {coverDims.w > 0 && (
            <p className="text-xs text-gray-400">Обкладинка: {coverDims.w}×{coverDims.h}px</p>
          )}
          {isKdpSelect && (
            <span className="inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              ⚠ KDP Select — тільки Amazon 90 днів
            </span>
          )}
        </div>
      </div>

      {/* ── Platform requirements checklist ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Вимоги платформ</h2>
          {totalFails === 0 && totalIssues === 0 ? (
            <span className="text-sm text-green-700 font-medium">✓ Всі платформи готові</span>
          ) : totalFails > 0 ? (
            <span className="text-sm text-red-600 font-medium">
              ✕ {totalFails} критичних вимог не виконано
            </span>
          ) : (
            <span className="text-sm text-amber-600 font-medium">
              ⚠ {totalIssues} увага
            </span>
          )}
        </div>

        {platforms.map((p) => (
          <PlatformSection key={p.key} platform={p} defaultOpen={countIssues(p) > 0} />
        ))}
      </div>

      {/* ── Reject book ──────────────────────────────────────────────────────── */}
      {!rejectDone && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-900">Відхилити книгу</h2>
            {totalIssues > 0 && (
              <button
                type="button"
                onClick={prefillRejection}
                className="text-xs text-red-600 underline hover:no-underline"
              >
                Заповнити з вимог платформ
              </button>
            )}
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Причина відхилення (буде надіслана автору)"
            rows={5}
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 font-mono"
          />
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={handleReject}
            loading={rejecting}
            disabled={!rejectReason.trim()}
          >
            Відхилити книгу
          </Button>
        </div>
      )}

      {rejectDone && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-medium">
          ✕ Книгу відхилено. Автора повідомлено.
        </div>
      )}

      {/* ── Книжкова палата ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Реєстрація в Книжковій палаті</h2>
          <p className="text-xs text-gray-400">
            Публічного API в Книжкової палати немає — подання відбувається поза системою. Позначте дату подання,
            а після отримання відповіді внесіть реальні ISBN/УДК/ББК/авторський знак нижче.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {book.bookChamberSubmittedAt ? (
            <>
              <span className="text-gray-600">
                Подано до Книжкової палати: <span className="font-mono">{fmtDate(book.bookChamberSubmittedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => saveBookChamber({ submittedAt: null })}
                className="text-gray-400 hover:text-red-600"
                title="Скасувати позначку"
              >
                ✕
              </button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              loading={savingBookChamber}
              onClick={() => saveBookChamber({ submittedAt: new Date().toISOString() })}
            >
              Позначити як подано
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">ISBN</label>
            <input
              value={bcIsbn}
              onChange={(e) => setBcIsbn(e.target.value)}
              placeholder="978-XXX-XXXX-XX-X"
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Авторський знак</label>
            <input
              value={bcAuthorSign}
              onChange={(e) => setBcAuthorSign(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">УДК</label>
            <input
              value={bcUdc}
              onChange={(e) => setBcUdc(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">ББК</label>
            <input
              value={bcBbk}
              onChange={(e) => setBcBbk(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        </div>

        {bookChamberError && <p className="text-sm text-red-500">{bookChamberError}</p>}

        <Button
          size="sm"
          loading={savingBookChamber}
          onClick={() =>
            saveBookChamber({
              isbn: bcIsbn.trim() || null,
              udcCode: bcUdc.trim() || null,
              bbkCode: bcBbk.trim() || null,
              authorSign: bcAuthorSign.trim() || null,
            })
          }
        >
          Зберегти
        </Button>
      </div>

      {/* ── Publication / contract / distribution timeline ────────────────────── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Публікація та договір</h2>
        <p className="text-xs text-gray-400 mb-4">
          Автор підписує договір з платформою один раз, у своєму профілі — тут лишається лише перевірка й публікація.
        </p>

        <TimelineRow
          done
          label="Книга створена"
          right={<span className="text-xs font-mono text-gray-400">{fmtDate(book.createdAt)}</span>}
        />

        {MAIN_STEPS.map((step, i) => {
          const value = book.publicationTimeline?.[step.key];
          const dateValue = value ? value.slice(0, 10) : "";
          const done = !!value;
          return (
            <TimelineRow
              key={step.key}
              done={done}
              active={firstPendingIdx === i + 1}
              label={step.label}
              right={
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="date"
                    value={dateValue}
                    disabled={savingStep === step.key}
                    onChange={(e) => saveTimelineStep(step.key, e.target.value)}
                    className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                  />
                  {dateValue && (
                    <button
                      type="button"
                      onClick={() => saveTimelineStep(step.key, "")}
                      disabled={savingStep === step.key}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              }
            />
          );
        })}

        {/* ── One-click publish (replaces the old 4-step contract_pending → contract_signed
            date entry — the contract itself is already signed by the author upfront) ── */}
        <div className="ml-7 mb-4 -mt-2 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500">Платіжні реквізити автора (для перевірки)</p>
          {book.author.payoutDetailsSubmittedAt ? (
            <dl className="space-y-1 text-xs text-gray-700">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-400">ІПН/РНОКПП:</dt>
                <dd className="font-mono">{book.author.taxId}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-400">Паспорт/ФОП:</dt>
                <dd>{book.author.payoutDocument}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-400">IBAN:</dt>
                <dd className="font-mono">{book.author.bankIban}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-400">Подано:</dt>
                <dd>{fmtDate(book.author.payoutDetailsSubmittedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-gray-400">
              Автор ще не подав платіжні реквізити — договір підписується один раз у профілі автора (/dashboard/settings/contract).
            </p>
          )}

          {book.publicationTimeline?.contract_signed ? (
            <div className="rounded-md bg-green-100 px-3 py-2 text-xs font-medium text-green-800">
              ✓ Опубліковано {fmtDate(book.publicationTimeline.contract_signed)}
              {book.isbn && <> · ISBN: {book.isbn}</>}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => saveTimelineStep("contract_signed", new Date().toISOString())}
              loading={savingStep === "contract_signed"}
              disabled={!book.publicationTimeline?.review_done}
              title={!book.publicationTimeline?.review_done ? "Спочатку позначте перевірку завершеною" : undefined}
            >
              Опублікувати книгу
            </Button>
          )}

          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="block text-xs text-gray-400 underline hover:no-underline"
          >
            {advancedOpen ? "Сховати ручне керування датами" : "Ручне керування датами (виправлення, повторна перевірка)"}
          </button>

          {advancedOpen && (
            <div className="space-y-1 border-t pt-3">
              {ADVANCED_STEPS.map((step) => {
                const value = book.publicationTimeline?.[step.key];
                const dateValue = value ? value.slice(0, 10) : "";
                return (
                  <div key={step.key} className="flex items-center justify-between gap-3 py-1">
                    <span className={cn("text-xs", value ? "font-semibold text-gray-700" : "text-gray-400")}>
                      {step.label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="date"
                        value={dateValue}
                        disabled={savingStep === step.key}
                        onChange={(e) => saveTimelineStep(step.key, e.target.value)}
                        className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                      />
                      {dateValue && (
                        <button
                          type="button"
                          onClick={() => saveTimelineStep(step.key, "")}
                          disabled={savingStep === step.key}
                          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <TimelineRow
          done={!!book.isbn}
          active={firstPendingIdx === TIMELINE_STEPS.length + 1}
          label={book.isbn ? `Публікація у магазинах / ISBN: ${book.isbn}` : "Публікація у магазинах"}
          right={!book.isbn && <span className="text-xs text-gray-400">очікує ISBN</span>}
        >
          <div className="flex items-center gap-1.5 py-2 text-sm">
            <span style={book.isbn ? { color: ACCENT } : undefined} className={!book.isbn ? "text-gray-300" : undefined}>
              {book.isbn ? "✓" : "○"}
            </span>
            <span style={book.isbn ? { color: ACCENT } : undefined} className={cn("font-medium", !book.isbn && "text-gray-400")}>
              Ulit
            </span>
            {book.publicationTimeline?.contract_signed && (
              <span className="text-gray-500">/ опубліковано {fmtDate(book.publicationTimeline.contract_signed)}</span>
            )}
          </div>
          <p className="mb-2 text-xs font-semibold text-gray-500">Розсилка файлів на зовнішні платформи</p>
          <div className="divide-y">
            {!isKdpSelect && (
              <ServiceRow
                name="Draft2Digital"
                subtitle="Apple Books, B&N, Kobo, Scribd"
                status={d2d}
                sentAt={book.d2dSentAt}
                saving={saving === "d2d"}
                onChange={(s) => saveService("d2d", s)}
              />
            )}
            <ServiceRow
              name="Amazon KDP"
              subtitle="Kindle Direct Publishing"
              status={kdp}
              sentAt={book.kdpSentAt}
              saving={saving === "kdp"}
              onChange={(s) => saveService("kdp", s)}
            />
            {!isKdpSelect && (
              <ServiceRow
                name="Google Play Books"
                subtitle="Google Books Partner Program"
                status={google}
                sentAt={book.googleSentAt}
                saving={saving === "google"}
                onChange={(s) => saveService("google", s)}
              />
            )}
          </div>
        </TimelineRow>
      </div>
    </div>
  );
}
