"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../../../hooks/useApi";
import { Button } from "../../../../../components/ui/button";

interface Book {
  id: string;
  title: string;
  description?: string | null;
  isbn?: string | null;
  coverUrl?: string | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
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
  author: { name: string; email: string };
}

const STATUS_OPTS = ["NOT_SENT", "SENT", "PUBLISHED", "ERROR"] as const;
const STATUS_COLORS: Record<string, string> = {
  NOT_SENT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ERROR: "bg-red-100 text-red-700",
};

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
          (book.priceEbook || book.pricePrint) ? "pass" : "warn",
          (book.priceEbook || book.pricePrint) ? "" : "Ціна не встановлена"),
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

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: Book }>(`/api/admin/books/${id}`)
      .then(({ book: b }) => {
        setBook(b);
        setD2d(b.d2dStatus);
        setKdp(b.kdpStatus);
        setGoogle(b.googleStatus);
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

      {/* ── Distribution services ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Статус дистрибуції</h2>

        {/* D2D */}
        {!isKdpSelect && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Draft2Digital (D2D)</h3>
                <p className="text-xs text-gray-500">Apple Books, B&N, Kobo, Scribd та інші</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[d2d]}`}>{d2d}</span>
            </div>
            {book.d2dSentAt && (
              <p className="text-xs text-gray-400 mb-3">Відправлено: {new Date(book.d2dSentAt).toLocaleString("uk-UA")}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => saveService("d2d", s)}
                  disabled={saving === "d2d" || d2d === s}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    d2d === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KDP */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Amazon KDP</h3>
              <p className="text-xs text-gray-500">Kindle Direct Publishing</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[kdp]}`}>{kdp}</span>
          </div>
          {book.kdpSentAt && (
            <p className="text-xs text-gray-400 mb-3">Відправлено: {new Date(book.kdpSentAt).toLocaleString("uk-UA")}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTS.map((s) => (
              <button
                key={s}
                onClick={() => saveService("kdp", s)}
                disabled={saving === "kdp" || kdp === s}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  kdp === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Google */}
        {!isKdpSelect && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Google Play Books</h3>
                <p className="text-xs text-gray-500">Google Books Partner Program</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[google]}`}>{google}</span>
            </div>
            {book.googleSentAt && (
              <p className="text-xs text-gray-400 mb-3">Відправлено: {new Date(book.googleSentAt).toLocaleString("uk-UA")}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => saveService("google", s)}
                  disabled={saving === "google" || google === s}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    google === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
