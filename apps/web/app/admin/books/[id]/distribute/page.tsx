"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../../../hooks/useApi";
import { Button } from "../../../../../components/ui/button";
import { cn } from "../../../../../lib/utils";
import { REJECTION_REASONS } from "shared-types";

interface Book {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
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
  printPageCount?: number | null;
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
  republishRequestedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
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
  // pageCount is only ever set by the old PAGE_THUMBNAILS job, which
  // nothing in the current publish flow triggers anymore (only the
  // retired BookViewer "PDF" tab called GET /api/books/:id/pages, the
  // thing that used to enqueue it) -- it's effectively dead for every book
  // published through today's pipeline. printPageCount, from the live
  // generate-pdf-print.ts job (Ghostscript pdfpagecount), is the real
  // source of truth now; same fallback order already used by
  // apps/api/.../print-cost.ts.
  const effectivePageCount = book.printPageCount ?? book.pageCount;
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
        check("desc", `Анотація ≥ 250 символів (${descLen})`,
          descLen >= 250 ? "pass" : descLen >= 100 ? "warn" : "fail",
          descLen >= 250 ? "" : `Анотація коротка для KDP (${descLen}/250 символів) — рекомендація, не блокує модерацію`),
        coverDimCheck(1600),
        check("genre", "Жанр вказано", book.genre ? "pass" : "fail",
          book.genre ? "" : "Жанр обов'язковий для KDP"),
        check("pages", effectivePageCount ? `Кількість сторінок (${effectivePageCount})` : "Кількість сторінок",
          (effectivePageCount ?? 0) > 0 ? "pass" : "warn",
          (effectivePageCount ?? 0) > 0 ? "" : "Кількість сторінок не визначена — перевірте конвертацію"),
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
        check("desc", `Анотація ≥ 50 символів (${descLen})`,
          descLen >= 50 ? "pass" : "fail",
          descLen >= 50 ? "" : `Анотація закоротка (${descLen}/50 символів)`),
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
        check("desc", `Анотація ≥ 150 символів (${descLen})`,
          descLen >= 150 ? "pass" : descLen >= 50 ? "warn" : "fail",
          descLen >= 150 ? "" : `Анотація коротка для Google Play Books (${descLen}/150 символів) — рекомендація, не блокує модерацію`),
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
    // Only "fail" actually blocks a platform -- "warn" (e.g. an annotation
    // shorter than KDP/Google's own recommended length) is informational,
    // not a real requirement: Ulit's own publish gate already requires
    // 120-500 characters (validateBook, apps/api/.../publish.ts) before a
    // book can even reach REVIEW, which already clears every platform's real
    // "fail" floor (KDP<100, Google/D2D<50) -- so a warn here can never mean
    // "doesn't meet Ulit's requirements", only "could be longer for that one
    // store's algorithm/SEO". Including warn here previously let admins
    // reject an otherwise-valid book over a purely optional recommendation,
    // worded as if it were a hard requirement.
    // ISBN is never something the author can act on (admin-only, assigned
    // after approval via the dedicated "Реєстрація ISBN" flow below) -- never
    // belongs in a rejection reason sent back to them.
    const issues = p.checks.filter((c) => c.result === "fail" && c.id !== "isbn");
    if (issues.length === 0) continue;
    lines.push(`${p.name}:`);
    for (const c of issues) {
      lines.push(`  ✕ ${c.hint || c.label}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

// Separate from buildRejectionText above on purpose -- "warn" checks (e.g.
// page count not yet determined, an annotation shorter than one platform's
// own recommended length) are real information worth handing to the author,
// but they're recommendations, not requirements: framed and worded
// differently here so appending this never reads as "your book was
// rejected because of this," the way a plain merged list would.
function buildWarningsText(platforms: Platform[]): string {
  const lines: string[] = ["Додатково, не блокує модерацію — рекомендації для кращих результатів на платформах:\n"];
  for (const p of platforms) {
    const warnings = p.checks.filter((c) => c.result === "warn" && c.id !== "isbn");
    if (warnings.length === 0) continue;
    lines.push(`${p.name}:`);
    for (const c of warnings) {
      lines.push(`  ⚠ ${c.hint || c.label}`);
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

// Real trademarked logo files aren't bundled here -- these are brand-colored
// lettermarks (same idea as e.g. a payment-provider dashboard's partner
// badges), recognizable at a glance without shipping external logo assets.
// Swap `mark` for an actual <img>/<svg> per platform later if real logo
// files get added to /public.
const PLATFORM_BRAND: Record<string, { bg: string; fg: string; mark: string }> = {
  kdp: { bg: "#131A22", fg: "#FF9900", mark: "KDP" },
  d2d: { bg: "#0E7C86", fg: "#ffffff", mark: "D2D" },
  google: { bg: "#4285F4", fg: "#ffffff", mark: "G" },
};

// One card per external distribution platform -- merges what used to be two
// separate things an admin had to visually reconcile (the "Вимоги платформ"
// checklist above, and the "Розсилка файлів" status buttons buried inside
// the timeline card further down): readiness and send-status for the same
// platform now live in the same block. Laid out 3-up so all three platforms
// are visible at once instead of one full-width accordion after another
// with a lot of unused width per row.
function PlatformCard({
  platform,
  status,
  sentAt,
  saving,
  onStatusChange,
  locked,
}: {
  platform: Platform;
  status: string;
  sentAt?: string | null;
  saving: boolean;
  onStatusChange: (status: string) => void;
  locked?: boolean;
}) {
  const issues = countIssues(platform);
  const fails = platform.checks.filter((c) => c.result === "fail").length;
  const [open, setOpen] = useState(fails > 0);
  const brand = PLATFORM_BRAND[platform.key] ?? { bg: "#374151", fg: "#ffffff", mark: platform.name.slice(0, 2).toUpperCase() };

  return (
    <div className="flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold tracking-tight"
          style={{ backgroundColor: brand.bg, color: brand.fg }}
        >
          {brand.mark}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 leading-tight truncate">{platform.name}</p>
          <p className="text-xs text-gray-400 truncate">{platform.subtitle}</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {issues === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            ✓ Готово до відправки
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            {fails > 0 ? `✕ ${fails} вимог не виконано` : `⚠ ${issues} увага`}
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="block text-xs text-gray-400 underline hover:no-underline"
        >
          {open ? "Сховати вимоги ▲" : "Показати вимоги ▼"}
        </button>

        {open && (
          <div className="-mx-4 border-t divide-y">
            {platform.checks.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-2.5 px-4 py-2.5 ${
                  c.result === "pass" ? "bg-white" : c.result === "warn" ? "bg-amber-50" : "bg-red-50"
                }`}
              >
                <CheckIcon result={c.result} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-medium ${
                      c.result === "pass" ? "text-gray-700" : c.result === "warn" ? "text-amber-800" : "text-red-800"
                    }`}
                  >
                    {c.label}
                  </p>
                  {c.hint && <p className="text-[0.6875rem] text-gray-500 mt-0.5">{c.hint}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t bg-gray-50 p-4 space-y-1.5">
        <p className="text-xs font-semibold text-gray-500">Статус розсилки</p>
        {locked ? (
          <p className="text-xs text-orange-700">🔒 Заблоковано на час дії KDP Select</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatusChange(s)}
                  disabled={saving || status === s}
                  className={`rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors disabled:opacity-50 ${
                    status === s ? "bg-gray-900 text-white" : "border bg-white hover:bg-gray-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {sentAt && <p className="text-[0.6875rem] text-gray-400">з {fmtDate(sentAt)}</p>}
          </>
        )}
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
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectDone, setRejectDone] = useState(false);
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bcIsbn, setBcIsbn] = useState("");
  const [bcUdc, setBcUdc] = useState("");
  const [bcAuthorSign, setBcAuthorSign] = useState("");
  const [savingBookChamber, setSavingBookChamber] = useState(false);
  const [bookChamberError, setBookChamberError] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [republishActionLoading, setRepublishActionLoading] = useState(false);
  const [republishError, setRepublishError] = useState("");
  const [republishRejectReason, setRepublishRejectReason] = useState("");
  const [isbnPkg, setIsbnPkg] = useState<{
    annotationTxtUrl: string;
    manuscriptPdfUrl: string;
    coverUrl: string | null;
    backCoverUrl: string | null;
    authorFullName: string | null;
    genre: string | null;
    language: string;
    printPageCount: number | null;
    isbn: string | null;
    udcCode: string | null;
    authorSign: string | null;
  } | null>(null);
  const [isbnPkgError, setIsbnPkgError] = useState("");
  const [isbnPkgLoading, setIsbnPkgLoading] = useState(true);
  const [annotationDownloading, setAnnotationDownloading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setIsbnPkgLoading(true);
    apiFetch<typeof isbnPkg>(`/api/admin/books/${id}/isbn-package`)
      .then((pkg) => setIsbnPkg(pkg))
      .catch((e: any) => setIsbnPkgError(e.message || "Дані ще не готові"))
      .finally(() => setIsbnPkgLoading(false));
  }, [token, id]);

  // annotation.txt is a direct admin-gated API route (not a pre-signed URL
  // like the other two package links), so a plain <a href> would 401 without
  // the bearer token -- same authenticated-blob-download pattern as
  // admin/isbn-queue/page.tsx.
  async function downloadAnnotation(url: string, filename: string) {
    setAnnotationDownloading(true);
    try {
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert(`Помилка завантаження: ${e.message}`);
    } finally {
      setAnnotationDownloading(false);
    }
  }

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

  async function handleApprove() {
    setApproving(true);
    setApproveError("");
    try {
      const { book: updated } = await apiFetch<{ book: Book }>(`/api/admin/books/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setBook(updated);
    } catch (e: any) {
      setApproveError(e.message || "Помилка схвалення");
    } finally {
      setApproving(false);
    }
  }

  function toggleReason(key: string) {
    setSelectedReasons((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleReject() {
    if (selectedReasons.length === 0 && !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await apiFetch(`/api/admin/books/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reasons: selectedReasons, note: rejectReason.trim() || undefined }),
      });
      setRejectDone(true);
    } finally {
      setRejecting(false);
    }
  }

  async function handleApproveRepublish() {
    setRepublishActionLoading(true);
    setRepublishError("");
    try {
      const { book: updated } = await apiFetch<{ book: Book }>(`/api/admin/books/${id}/republish`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setBook(updated);
    } catch (e: any) {
      setRepublishError(e.message || "Помилка схвалення змін");
    } finally {
      setRepublishActionLoading(false);
    }
  }

  async function handleRejectRepublish() {
    setRepublishActionLoading(true);
    setRepublishError("");
    try {
      const { book: updated } = await apiFetch<{ book: Book }>(`/api/admin/books/${id}/republish/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: republishRejectReason || undefined }),
      });
      setBook(updated);
      setRepublishRejectReason("");
    } catch (e: any) {
      setRepublishError(e.message || "Помилка відхилення змін");
    } finally {
      setRepublishActionLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400 p-8">Завантаження…</div>;
  }
  if (!book) return null;

  const isKdpSelect = book.distributionStrategy === "KDP_SELECT";
  const platforms = buildPlatforms(book, coverDims.w, coverDims.h);
  // ISBN is excluded from this top-level "critical requirements" banner --
  // it's tracked by its own dedicated "Реєстрація ISBN" checklist below, and
  // is expected to be unset here (a book only gets one after moderation
  // approval). Each platform's own expanded section still shows its ISBN
  // check individually (still real info for actually sending to KDP/Google
  // later) -- only the aggregate banner ignores it, so it stops reading as
  // an alarming "critical" blocker on a freshly-submitted book.
  const totalIssues = platforms.reduce(
    (s, p) => s + p.checks.filter((c) => c.result !== "pass" && c.id !== "isbn").length,
    0
  );
  const totalFails = platforms.reduce(
    (s, p) => s + p.checks.filter((c) => c.result === "fail" && c.id !== "isbn").length,
    0
  );

  const totalWarns = platforms.reduce(
    (s, p) => s + p.checks.filter((c) => c.result === "warn" && c.id !== "isbn").length,
    0
  );

  function prefillRejection() {
    setRejectReason(buildRejectionText(platforms));
  }

  // Separate action on purpose -- appends rather than replaces, so an admin
  // can combine hard requirements (prefillRejection) with these soft notes,
  // or send warnings alone on a book that otherwise has none.
  function appendWarnings() {
    setRejectReason((prev) => {
      const warningsText = buildWarningsText(platforms);
      return prev.trim() ? `${prev.trim()}\n\n${warningsText}` : warningsText;
    });
  }

  const doneFlags = [true, ...TIMELINE_STEPS.map((s) => !!book.publicationTimeline?.[s.key])];
  const firstPendingIdx = doneFlags.findIndex((d) => !d);

  return (
    <div className="space-y-6">
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

      {/* ── Republish review: staged post-publish changes ─────────────────────── */}
      {/* Only Назва/Анотація/Жанр stage into pending* (book.ts's PATCH) --
          everything else an author edits on a live book (price, format,
          authors, distribution...) already applies instantly, no review
          needed. Shows a before/after per changed field so the admin isn't
          approving blind -- previously this queue only existed as an
          unlabeled badge on /admin/books with no detail view at all. */}
      {book.status === "PUBLISHED" && book.republishRequestedAt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-900">Зміни на повторну модерацію</h2>
            <span className="text-xs text-amber-600">надіслано {fmtDate(book.republishRequestedAt)}</span>
          </div>

          <div className="space-y-2">
            {book.pendingTitle != null && (
              <div className="rounded-lg bg-white border border-amber-200 p-3 text-sm">
                <p className="text-xs font-semibold text-amber-700 mb-1">Назва</p>
                <p className="text-gray-400 line-through text-xs">{book.title}</p>
                <p className="text-gray-900 font-medium">{book.pendingTitle}</p>
              </div>
            )}
            {book.pendingDescription != null && (
              <div className="rounded-lg bg-white border border-amber-200 p-3 text-sm">
                <p className="text-xs font-semibold text-amber-700 mb-1">Анотація</p>
                <p className="text-gray-400 line-through text-xs whitespace-pre-wrap">{book.description}</p>
                <p className="text-gray-900 whitespace-pre-wrap">{book.pendingDescription}</p>
              </div>
            )}
            {book.pendingGenre != null && (
              <div className="rounded-lg bg-white border border-amber-200 p-3 text-sm">
                <p className="text-xs font-semibold text-amber-700 mb-1">Жанр</p>
                <p className="text-gray-400 line-through text-xs">{book.genre || "—"}</p>
                <p className="text-gray-900 font-medium">{book.pendingGenre || "—"}</p>
              </div>
            )}
            {book.pendingTitle == null && book.pendingDescription == null && book.pendingGenre == null && (
              <p className="text-xs text-amber-700">
                Оновлений файл рукопису (без змін у назві/анотації/жанрі) — файли перегенеруються після схвалення.
              </p>
            )}
          </div>

          {republishError && <p className="text-sm text-red-600">{republishError}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={handleApproveRepublish}
              loading={republishActionLoading}
            >
              ✓ Схвалити зміни
            </Button>
            <input
              value={republishRejectReason}
              onChange={(e) => setRepublishRejectReason(e.target.value)}
              placeholder="Причина відхилення (необов'язково)"
              className="flex-1 min-w-[12rem] rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={handleRejectRepublish}
              loading={republishActionLoading}
            >
              ✕ Відхилити зміни
            </Button>
          </div>
        </div>
      )}

      {/* ── Distribution platforms: readiness + send status, 3-up ────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Розповсюдження</h2>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((p) => {
            const statusFor: Record<string, { status: string; sentAt: string | null | undefined; onChange: (s: string) => void; locked: boolean }> = {
              kdp: { status: kdp, sentAt: book.kdpSentAt, onChange: (s) => saveService("kdp", s), locked: false },
              d2d: { status: d2d, sentAt: book.d2dSentAt, onChange: (s) => saveService("d2d", s), locked: isKdpSelect },
              google: { status: google, sentAt: book.googleSentAt, onChange: (s) => saveService("google", s), locked: isKdpSelect },
            };
            const wiring = statusFor[p.key];
            return (
              <PlatformCard
                key={p.key}
                platform={p}
                status={wiring.status}
                sentAt={wiring.sentAt}
                saving={saving === p.key}
                onStatusChange={wiring.onChange}
                locked={wiring.locked}
              />
            );
          })}
        </div>
      </div>

      {/* ── Moderation approval ──────────────────────────────────────────────── */}
      {/* This checklist above is about EXTERNAL platform readiness (KDP/D2D/
          Google) -- ISBN specifically is expected to fail here (see the
          "Реєстрація ISBN" section below, a separate later stage), so
          approval isn't gated on the checklist being all-green, same as
          rejection isn't either -- the admin judges content, the checklist
          is context, not a blocker. */}
      {book.moderationStatus === "APPROVED" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          ✓ Модерація успішна{book.status === "PUBLISHED" && " · книга опублікована на Ulit"}
        </div>
      ) : (
        !rejectDone && (
          <div className="rounded-xl border border-green-100 bg-green-50 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-green-900">Модерація</h2>
            <p className="text-xs text-green-800">
              Схвалення публікує книгу на Ulit одразу (без ISBN — ISBN потрібен лише окремим зовнішнім магазинам,
              не для продажу на самому Ulit). Наступний крок після цього — «Реєстрація УДК (+ ISBN)» нижче.
            </p>
            {approveError && <p className="text-sm text-red-600">{approveError}</p>}
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={handleApprove}
              loading={approving}
            >
              ✓ Модерація успішна
            </Button>
          </div>
        )
      )}

      {/* ── Reject book ──────────────────────────────────────────────────────── */}
      {!rejectDone && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-900">Відхилити книгу</h2>
            <div className="flex items-center gap-3">
              {totalWarns > 0 && (
                <button
                  type="button"
                  onClick={appendWarnings}
                  title="Рекомендації для платформ (не блокують модерацію) -- додає, не замінює написане"
                  className="text-xs text-amber-700 underline hover:no-underline"
                >
                  + Додати попередження
                </button>
              )}
              {totalFails > 0 && (
                <button
                  type="button"
                  onClick={prefillRejection}
                  className="text-xs text-red-600 underline hover:no-underline"
                >
                  Заповнити з вимог платформ
                </button>
              )}
            </div>
          </div>

          {/* Fixed taxonomy (shared-types) instead of freeform text -- lets
              every author-facing page know EXACTLY which field a rejection is
              about, and detect "resolved" as "this field changed since
              rejection" instead of merely "this field is non-empty" (which
              can't tell a MISSING value apart from a WRONG-but-present one). */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {REJECTION_REASONS.map((r) => (
              <label key={r.key} className="flex items-center gap-1.5 text-xs text-red-900">
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(r.key)}
                  onChange={() => toggleReason(r.key)}
                  className="rounded border-red-300"
                />
                {r.label}
              </label>
            ))}
          </div>

          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Додатковий коментар (необов'язково) -- не автоматизується, лишається доти, доки ви не переглянете книгу повторно"
            rows={4}
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 font-mono"
          />
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={handleReject}
            loading={rejecting}
            disabled={selectedReasons.length === 0 && !rejectReason.trim()}
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

      {/* ── Книжкова палата / Реєстрація УДК ──────────────────────────────────── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Реєстрація УДК (+ ISBN)</h2>
          <p className="text-xs text-gray-400">
            ISBN — самообслуговування: видавець сам призначає номер зі свого блоку, ніякого подання до Книжкової
            палати не потребує (крок 3 нижче). УДК + авторський знак («шифр зберігання») — навпаки, реальна заявка
            по цій конкретній книзі, поза системою (адмін сам надсилає дані зовнішнім каналом, публічного API немає)
            — файли для неї зібрані нижче.
          </p>
        </div>

        {/* Step 1 — download the submission package */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-semibold text-gray-800">1. Завантажити файли</p>
          {isbnPkgLoading ? (
            <p className="text-xs text-gray-400">Готуємо файли…</p>
          ) : isbnPkgError ? (
            <p className="text-xs text-amber-600">⚠ {isbnPkgError}</p>
          ) : isbnPkg ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={annotationDownloading}
                  onClick={() => downloadAnnotation(isbnPkg.annotationTxtUrl, `${book.title}-zayavka.txt`)}
                >
                  📄 Файл 1 — заявка (назва, ПІБ, анотація, коди) (.txt)
                </Button>
                <a href={isbnPkg.manuscriptPdfUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">📘 Файл 2 — рукопис (PDF)</Button>
                </a>
                {isbnPkg.coverUrl && (
                  <a href={isbnPkg.coverUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">🖼 Файл 3 — обкладинка (перед)</Button>
                  </a>
                )}
                {isbnPkg.backCoverUrl && (
                  <a href={isbnPkg.backCoverUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">🖼 Файл 4 — обкладинка (зад)</Button>
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Автор: {isbnPkg.authorFullName || "—"} · Мова: {isbnPkg.language} · Жанр: {isbnPkg.genre || "—"} ·
                Сторінок: {isbnPkg.printPageCount ?? "—"}
                {isbnPkg.isbn && <> · ISBN: <span className="font-mono">{isbnPkg.isbn}</span></>}
                {isbnPkg.udcCode && <> · УДК: <span className="font-mono">{isbnPkg.udcCode}</span></>}
                {isbnPkg.authorSign && <> · Авт. знак: <span className="font-mono">{isbnPkg.authorSign}</span></>}
              </p>
              <p className="text-xs text-gray-400">
                Для друкованого видання не забути про обов&apos;язкові примірники (2 шт., за рахунок автора) для
                звіту в Книжкову палату — докладніше в{" "}
                <code className="text-[0.6875rem]">docs/isbn-udc-requirements.md</code>. Заявку на УДК + авторський
                знак надсилати на <code className="text-[0.6875rem]">udc2920054@ukr.net</code>, тема листа:{" "}
                <code className="text-[0.6875rem]">«УДК, [назва видавця]»</code>.
              </p>
              {/* Колофон рукопису більше не "запечено" -- генерується заново з
                  живих даних книги при кожному рендері друкованого PDF
                  (frontMatter.ts у shared-types). Обкладинка й далі окрема
                  проблема: штрихкод там запікається в растрове зображення
                  під час дизайну, тому попередження лишається тільки для неї. */}
              {(isbnPkg.isbn || isbnPkg.udcCode) && (
                <p className="text-xs text-amber-600">
                  ⚠ ISBN/УДК на обкладинці фіксуються в растровому зображенні на момент дизайну, а не оновлюються
                  автоматично після присвоєння — переконайтесь, що{" "}
                  <Link href={`/dashboard/books/${id}/cover`} className="underline hover:no-underline">
                    обкладинка
                  </Link>{" "}
                  показує актуальні значення, перш ніж надсилати файли.
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Step 2 — hand off externally, mark the date */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-semibold text-gray-800">2. Відправити в Книжкову палату</p>
          <p className="text-xs text-gray-500">
            Виконується особисто адміном — зовнішнім каналом (email тощо), поза системою.
          </p>
          <div className="flex flex-col gap-1.5 text-sm">
            {book.bookChamberSubmittedAt ? (
              <div className="flex items-center gap-3">
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
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                loading={savingBookChamber}
                onClick={() => saveBookChamber({ submittedAt: new Date().toISOString() })}
              >
                Я вже подав(ла) цю книгу до Книжкової палати
              </Button>
            )}
          </div>
        </div>

        {/* Step 3 — ISBN is self-service (впишіть номер зі свого блоку, не
            з листа від Палати); УДК + авторський знак — це те, що прийде
            від Книжкової палати у відповідь на заявку з кроку 1. */}
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold text-gray-800">3. Присвоїти ISBN + УДК</p>
          <p className="text-xs text-gray-500">
            ISBN — впишіть номер зі свого блоку (самообслуговування, не потребує відповіді Палати). УДК + авторський
            знак — внесіть дані, отримані від Книжкової палати у відповідь на заявку.
          </p>
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
          </div>

          {bookChamberError && <p className="text-sm text-red-500">{bookChamberError}</p>}

          <Button
            size="sm"
            loading={savingBookChamber}
            disabled={!bcIsbn.trim()}
            onClick={() =>
              saveBookChamber({
                isbn: bcIsbn.trim() || null,
                udcCode: bcUdc.trim() || null,
                authorSign: bcAuthorSign.trim() || null,
              })
            }
          >
            Присвоїти ISBN + УДК
          </Button>
        </div>
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
          <p className="text-xs text-gray-400">
            Розсилка на зовнішні платформи (D2D/KDP/Google) — у блоці «Розповсюдження» вище.
          </p>
        </TimelineRow>
      </div>
    </div>
  );
}
