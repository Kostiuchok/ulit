"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewRangeEditor } from "@/components/books/PreviewRangeEditor";
import { FormatsAndDistribution, computeAnchorPrices, type PrintCost } from "@/components/books/FormatsAndDistribution";
import { KdpSelectPanel } from "@/components/books/KdpSelectPanel";
import { PublishButton } from "@/components/books/PublishButton";
import { RepublishButton } from "@/components/books/RepublishButton";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { DISTRIBUTION_PLATFORMS } from "@/lib/distributionPlatforms";
import {
  getUnresolvedRejectionLines,
  resolveRejectionLineSection,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from "@/lib/rejectedBlocks";
import { cn } from "@/lib/utils";
import { PRINT_FORMATS, PRINT_FORMAT_KEYS, resolveBookPrintFormat, type PrintFormatKey } from "shared-types";

// T-2060 п.1/п.3 -- confirmed by live Ridero test (2026-08-17), matches
// apps/api/src/modules/books/publish.ts's DESCRIPTION_MIN_LENGTH/MAX_LENGTH.
// (Values live in rejectedBlocks.ts now -- isRejectionLineResolved's
// description check needs the exact same thresholds this form validates
// against, so there's one definition instead of two that could drift.)

// Each external platform's own annotation-length recommendation -- kept in
// sync manually with admin/books/[id]/distribute/page.tsx's per-platform
// checklist (same numbers, "desc" check per platform). Ulit's own gate
// above (120-500) is the only thing that actually blocks /publish; these are
// informational -- live badges here let the author see, while typing,
// which stores their annotation is already long enough for, in ascending
// order so badges light up left-to-right as they keep writing.
const DESCRIPTION_PLATFORM_TARGETS = [
  { key: "d2d", label: "D2D", minChars: 50 },
  { key: "google", label: "Google Play", minChars: 150 },
  { key: "kdp", label: "Amazon KDP", minChars: 250 },
] as const;

const infoSchema = z.object({
  title: z.string().min(3, "Назва має містити щонайменше 3 символи").max(255),
  subtitle: z.string().max(255).optional(),
  description: z
    .string()
    .min(DESCRIPTION_MIN_LENGTH, `Анотація має містити щонайменше ${DESCRIPTION_MIN_LENGTH} символів`)
    .max(DESCRIPTION_MAX_LENGTH, `Анотація має містити не більше ${DESCRIPTION_MAX_LENGTH} символів`),
  genre: z.string().max(100).optional(),
  // Independent from genre -- the author picks this directly, from
  // PRINT_FORMAT_KEYS (shared-types), same list BookWizard's creation-time
  // selector uses.
  printFormatKey: z.string().min(1, "Оберіть розмір книги"),
  ageRating: z.string().min(1, "Вкажіть вікові обмеження"),
  language: z.string().length(2),
  aiGenerated: z.boolean().optional(),
  aiGeneratedNote: z.string().max(1000).optional(),
  // Only relevant for a book already published elsewhere before joining
  // ULIT -- see "Авторське право / попередня публікація" block below.
  copyrightYear: z.string().max(4).optional(),
  copyrightHolder: z.string().max(255).optional(),
  priorPublicationCertificate: z.string().max(100).optional(),
});
type InfoForm = z.infer<typeof infoSchema>;

// T-2075 -- only the optional B&W alternative prices are still raw manual
// inputs. priceEbook/pricePrint/pricePrintHardcover moved to the merged
// "Ціна та розповсюдження" section (FormatsAndDistribution + anchor pricing,
// same as BookWizard's step 2) -- there's no per-B&W production cost in
// print-cost.ts to build a royalty calculator against, so this stays as-is.
const priceSchema = z.object({
  pricePrintBw: z.coerce.number().positive().optional().or(z.literal("")),
  pricePrintHardcoverBw: z.coerce.number().positive().optional().or(z.literal("")),
});
type PriceForm = z.infer<typeof priceSchema>;

interface CoAuthor {
  name: string;
}

// T-2060 п.4 — structured per-book authors, independent of the account profile.
interface BookAuthor {
  lastName: string;
  firstName: string;
  middleName?: string;
  photoUrl?: string;
}

// T-2060 п.5 — "Над книгою працювали", separate entity from bookAuthors.
interface Contributor {
  role: string;
  name: string;
}

const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
];

const AGE_RATINGS = ["0+", "0-6", "6-10", "11-14", "15-17", "18+"];

// T-2060 п.7 -- section labels for the single-scroll layout (used as plain
// headings now, not a StepIndicator/paginated wizard). T-2073 reuses these
// same labels for a sticky anchor nav so the author can see every section
// up front and jump to one without scrolling -- the scroll stays a single
// continuous page (T-2060's decision, Ridero-driven), the nav just adds a
// way to see/reach every section from the top instead of only forward.
// T-2075 -- "price" and "distribution" used to be two separate sections;
// merged into one ("Ціна та розповсюдження", FormatsAndDistribution.tsx) for
// the same reason BookWizard's steps 2/3 merged: a shelf price genuinely
// depends on which channels are enabled and their commissions, so asking for
// one before the other was backwards and the two sections' "which stores"
// concepts visibly overlapped.
const SECTION_LABELS = {
  info: "Інформація",
  file: "Рукопис",
  cover: "Обкладинка",
  price: "Ціна та розповсюдження",
  review: "Огляд перед публікацією",
  publish: "Публікація",
};
const SECTION_ORDER = Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[];

interface MetadataBook {
  status: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  ageRating?: string | null;
  language: string;
  coverUrl?: string | null;
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  desiredRoyaltyAmountPrint?: number | string | null;
  aiGenerated?: boolean;
  aiGeneratedNote?: string | null;
  coAuthors?: CoAuthor[] | null;
  bookAuthors?: BookAuthor[] | null;
  contributors?: Contributor[] | null;
  authorBio?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  epubUrl?: string | null;
  pdfUrl?: string | null;
  pageCount?: number | null;
  printPageCount?: number | null;
  printPdfUrl?: string | null;
  previewStart?: number | null;
  previewEnd?: number | null;
  originalDocxUrl?: string | null;
  distributionChannels?: string[] | null;
  publicationTimeline?: Record<string, string> | null;
  publishedAt?: string | null;
  docxUpdatedAt?: string | null;
  republishRequestedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
  copyrightYear?: string | null;
  copyrightHolder?: string | null;
  priorPublicationCertificate?: string | null;
}

// docs/isbn-udc-requirements.md, "Детальний технічний чекліст оформлення ISBN" (2026-08-17).
// Орієнтовно "пів сторінки" ≈ 900-1000 знаків -- м'якший поріг, ніж наша сувора верхня межа
// анотації (500, T-2060), тому це окрема (не блокуюча) перевірка, не заміна existing validation.
const ISBN_ANNOTATION_HALF_PAGE_CHARS = 1000;

interface IsbnChecklistItem {
  label: string;
  done: boolean;
  hint?: string;
  linkHref?: string;
  linkLabel?: string;
}

function IsbnReadinessChecklist({
  book,
  bookAuthors,
  bookId,
}: {
  book: MetadataBook | null;
  bookAuthors: BookAuthor[];
  bookId: string;
}) {
  // ISBN is self-service (видавець сам призначає з власного блоку номерів,
  // жодного зовнішнього подання не потребує) -- this checklist is actually
  // about readiness for УДК + авторський знак ("шифр зберігання"), the one
  // that DOES need an external request to Книжкова палата. Gated on
  // udcCode, not isbn -- a book can already have its ISBN self-assigned and
  // still very much need УДК (/api/admin/isbn-queue's own where clause
  // checks udcCode: null for exactly this reason).
  if (book?.udcCode) {
    return (
      <div className="rounded-xl border bg-white p-5 text-sm">
        <p className="flex items-center gap-2 text-gray-700">
          <span className="text-green-600">✓</span>
          УДК вже присвоєно — реєстрація в Книжковій палаті не потрібна.
        </p>
      </div>
    );
  }

  const hasAuthorName = bookAuthors.some((a) => a.lastName.trim() && a.firstName.trim());
  const descLength = (book?.description ?? "").length;
  const annotationOk = descLength > 0 && descLength <= ISBN_ANNOTATION_HALF_PAGE_CHARS;

  const items: IsbnChecklistItem[] = [
    {
      label: "Анотація (файл 1 для заявки на УДК) — не більше пів сторінки",
      done: annotationOk,
      hint: !annotationOk && descLength > 0 ? `${descLength} символів — орієнтовно більше пів сторінки` : undefined,
    },
    {
      label: "Повне ПІБ автора (файл 1 для заявки на УДК)",
      done: hasAuthorName,
      hint: !hasAuthorName ? "Додайте прізвище та ім'я автора вище, у розділі «Автори книги»" : undefined,
    },
    { label: "Обкладинка завантажена", done: !!book?.coverUrl },
    // printPdfUrl is only ever generated by GET /api/books/:id/print-preview
    // (apps/api/src/modules/books/print-preview.ts) -- author-only (ownership
    // check), and only triggered by opening /manuscript/preview. Nothing else
    // in the publish flow creates it (T-2057 deliberately removed it from the
    // automatic conversion batch, since manuscriptContent doesn't exist yet
    // at .docx-upload time). Admin's isIsbnReady() requires this field too,
    // so a book missing it silently never appears in /admin/isbn-queue no
    // matter how "ready" the rest of this checklist looks.
    {
      label: "Друкований PDF рукопису (файл 2 для заявки на УДК)",
      done: !!book?.printPdfUrl,
      hint: !book?.printPdfUrl ? "Ще не згенеровано — натисніть посилання нижче, щоб створити" : undefined,
      linkHref: !book?.printPdfUrl ? `/dashboard/books/${bookId}/manuscript/preview` : undefined,
      linkLabel: "Згенерувати друкований PDF (відкриє передперегляд рукопису) →",
    },
  ];

  return (
    <div className="rounded-xl border bg-white p-5 space-y-3 text-sm">
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
        автоматично в межах друкованого PDF вище — окремо готувати цю структуру не потрібно.
      </p>
    </div>
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

// Same ✓/○ language as IsbnReadinessChecklist and every other readiness
// list on this page -- the circle sits left of the section's own vertical
// line (not inside it) so it reads as "status of everything past this
// line", matching the request to place it before the divider, not after.
function SectionHeading({ label, done }: { label: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
      <span className={done ? "text-green-600" : "text-amber-500"} title={done ? "Виконано" : "Ще не виконано"}>
        {done ? "✓" : "○"}
      </span>
      <span className="border-l-2 border-gray-900 pl-3">{label}</span>
    </h2>
  );
}

function OutputDataContent() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, apiUpload } = useApi();
  const { book, setBook, loading } = useBook<MetadataBook>(id);

  const [infoSaved, setInfoSaved] = useState(false);
  // Which sensitive fields (if any) the last save actually staged as
  // pending instead of publishing live -- drives the "✓ Збережено" note
  // right where the save happened, matching what RepublishButton shows
  // further down the same page.
  const [justStagedFields, setJustStagedFields] = useState<string[]>([]);
  const [infoError, setInfoError] = useState("");
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [newCoAuthorName, setNewCoAuthorName] = useState("");
  const [authorPhotoUploading, setAuthorPhotoUploading] = useState(false);
  const [authorPhotoError, setAuthorPhotoError] = useState("");
  const authorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [bookAuthors, setBookAuthors] = useState<BookAuthor[]>([]);
  const [newAuthor, setNewAuthor] = useState<BookAuthor>({ lastName: "", firstName: "", middleName: "", photoUrl: "" });
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [newContributor, setNewContributor] = useState<Contributor>({ role: "", name: "" });
  const [authorBio, setAuthorBio] = useState("");

  // Account profile (Налаштування профілю) -- single source of truth for
  // ПІБ/аватар/біографія, reused to auto-fill "Автори книги" and "Біографія
  // автора" below when this book doesn't already have its own (never
  // overwrites an already-customized per-book value). Bio, unlike ПІБ, syncs
  // both ways: saving here also writes back to the account profile (see
  // onSubmitInfo), per author's explicit request.
  interface AccountProfile {
    firstName?: string | null;
    lastName?: string | null;
    patronymic?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
  }
  const [userProfile, setUserProfile] = useState<AccountProfile | null>(null);
  const profileAutofillApplied = useRef(false);

  useEffect(() => {
    apiFetch<{ user: AccountProfile }>("/api/users/me")
      .then(({ user }) => setUserProfile(user))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!book || !userProfile || profileAutofillApplied.current) return;
    profileAutofillApplied.current = true;

    const bookHasAuthors = Array.isArray(book.bookAuthors) && book.bookAuthors.length > 0;
    if (!bookHasAuthors && (userProfile.firstName || userProfile.lastName)) {
      setNewAuthor({
        lastName: userProfile.lastName ?? "",
        firstName: userProfile.firstName ?? "",
        middleName: userProfile.patronymic ?? "",
        photoUrl: userProfile.avatarUrl ?? "",
      });
    }
    if (!book.authorBio && userProfile.bio) {
      setAuthorBio(userProfile.bio);
    }
  }, [book, userProfile]);

  // "Авторське право / попередня публікація" -- claiming an existing ISBN
  // from before the book joined ULIT is a separate action from the rest of
  // "Інформація" (its own endpoint, PATCH .../claim-isbn, with its own
  // validation), so it gets its own small form/state instead of going
  // through infoForm.
  const [claimIsbnValue, setClaimIsbnValue] = useState("");
  const [claimIsbnAttested, setClaimIsbnAttested] = useState(false);
  const [claimIsbnSaving, setClaimIsbnSaving] = useState(false);
  const [claimIsbnError, setClaimIsbnError] = useState("");

  const [priceSaved, setPriceSaved] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [printCost, setPrintCost] = useState<PrintCost | null>(null);
  const [channels, setChannels] = useState<string[]>(["ULIT"]);
  const [royaltyEbook, setRoyaltyEbook] = useState("");
  const [royaltyPrint, setRoyaltyPrint] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<PrintCost>(`/api/books/${id}/print-cost`).then(setPrintCost).catch(() => {});
  }, [id]);

  // T-2073 -- sticky header: tracks which section is under the title+nav
  // block so its pill can highlight, without turning the page into tabs
  // (every section still renders at once, this only decides which nav
  // button looks "current"). rootMargin's negative top matches the sticky
  // block's own height (title + nav, ~104px now that they're grouped
  // together, see the sticky wrapper below) so a section only counts as
  // active once it's actually past the block, and the large negative
  // bottom keeps just the topmost visible section active instead of the
  // whole viewport's worth of sections.
  const [activeSection, setActiveSection] = useState<(typeof SECTION_ORDER)[number]>("info");
  const sectionRefs = useRef<Partial<Record<(typeof SECTION_ORDER)[number], HTMLElement | null>>>({});
  // T-2076 -- a rejection-reason line the author clicks (resolveRejectionLineSection)
  // scrolls to AND rings the target section in yellow for a bit, so "go fix this"
  // lands on the exact block instead of just the top of the page.
  const [highlightSection, setHighlightSection] = useState<(typeof SECTION_ORDER)[number] | null>(null);

  function jumpToRejectionTarget(key: (typeof SECTION_ORDER)[number]) {
    scrollToSection(key);
    setHighlightSection(key);
    setTimeout(() => setHighlightSection((cur) => (cur === key ? null : cur)), 4000);
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSection(visible[0].target.id.replace("section-", "") as (typeof SECTION_ORDER)[number]);
        }
      },
      { rootMargin: "-104px 0px -70% 0px", threshold: 0 }
    );
    SECTION_ORDER.forEach((key) => {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [book]);

  function scrollToSection(key: (typeof SECTION_ORDER)[number]) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const infoForm = useForm<InfoForm>({ resolver: zodResolver(infoSchema) });
  const priceForm = useForm<PriceForm>({ resolver: zodResolver(priceSchema) });

  const titleValue = infoForm.watch("title") ?? "";
  const descValue = infoForm.watch("description") ?? "";
  const aiGeneratedValue = infoForm.watch("aiGenerated") ?? false;

  // Розмір книги is its own independent field now (not derived from genre)
  // -- same "Розмір книги" selector BookWizard's creation step has, so it
  // can be changed after creation too, not just once at the start.
  const selectedFormatKey = (infoForm.watch("printFormatKey") || "standard") as PrintFormatKey;
  const displayFormat = PRINT_FORMATS[selectedFormatKey] ?? PRINT_FORMATS.standard;

  // Hydrates every editable field from the freshly-loaded book -- but only
  // ONCE, on initial load. useBook() silently refetches in the background
  // whenever the tab regains focus (switching windows/apps and back), which
  // gives `book` a new object reference on every such refetch; without this
  // guard, that silent refetch re-ran this whole effect and clobbered any
  // unsaved typing (subtitle, age rating, a just-typed author name never
  // yet clicked "+ Додати автора"...) with whatever was still on the server.
  // Every save handler on this page already calls setBook(updated) itself
  // and keeps its own local state in sync with what it just submitted, so
  // there's nothing this effect needs to pick up after the first load.
  const bookHydratedRef = useRef(false);
  useEffect(() => {
    if (!book || bookHydratedRef.current) return;
    bookHydratedRef.current = true;
    setCoAuthors(Array.isArray(book.coAuthors) ? book.coAuthors : []);
    setBookAuthors(Array.isArray(book.bookAuthors) ? book.bookAuthors : []);
    setContributors(Array.isArray(book.contributors) ? book.contributors : []);
    setAuthorBio(book.authorBio ?? "");
    infoForm.reset({
      title: book.title,
      subtitle: book.subtitle ?? "",
      description: book.description ?? "",
      genre: book.genre ?? "",
      printFormatKey: resolveBookPrintFormat(book).key,
      ageRating: book.ageRating ?? "",
      language: book.language,
      aiGenerated: book.aiGenerated ?? false,
      aiGeneratedNote: book.aiGeneratedNote ?? "",
      copyrightYear: book.copyrightYear ?? "",
      copyrightHolder: book.copyrightHolder ?? "",
      priorPublicationCertificate: book.priorPublicationCertificate ?? "",
    });
    priceForm.reset({
      pricePrintBw: book.pricePrintBw ? Number(book.pricePrintBw) : "",
      pricePrintHardcoverBw: book.pricePrintHardcoverBw ? Number(book.pricePrintHardcoverBw) : "",
    });
    setChannels(Array.isArray(book.distributionChannels) && book.distributionChannels.length > 0 ? book.distributionChannels : ["ULIT"]);
    setRoyaltyEbook(book.desiredRoyaltyAmount ? String(Number(book.desiredRoyaltyAmount)) : "");
    setRoyaltyPrint(book.desiredRoyaltyAmountPrint ? String(Number(book.desiredRoyaltyAmountPrint)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  function toggleChannel(key: string) {
    if (key === "ULIT") return;
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  function addCoAuthor() {
    const name = newCoAuthorName.trim();
    if (!name) return;
    setCoAuthors((prev) => [...prev, { name }]);
    setNewCoAuthorName("");
  }

  function addBookAuthor() {
    if (!newAuthor.lastName.trim() || !newAuthor.firstName.trim()) return;
    setBookAuthors((prev) => [...prev, {
      lastName: newAuthor.lastName.trim(),
      firstName: newAuthor.firstName.trim(),
      middleName: newAuthor.middleName?.trim() || undefined,
      photoUrl: newAuthor.photoUrl?.trim() || undefined,
    }]);
    setNewAuthor({ lastName: "", firstName: "", middleName: "", photoUrl: "" });
  }

  async function handleAuthorPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAuthorPhotoError("");
    setAuthorPhotoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { url } = await apiUpload<{ url: string }>(`/api/books/${id}/author-photo`, form);
      setNewAuthor((p) => ({ ...p, photoUrl: url }));
    } catch (e: any) {
      setAuthorPhotoError(e.message || "Не вдалося завантажити фото");
    } finally {
      setAuthorPhotoUploading(false);
    }
  }

  function removeBookAuthor(index: number) {
    setBookAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  function addContributor() {
    if (!newContributor.role.trim() || !newContributor.name.trim()) return;
    setContributors((prev) => [...prev, { role: newContributor.role.trim(), name: newContributor.name.trim() }]);
    setNewContributor({ role: "", name: "" });
  }

  function removeContributor(index: number) {
    setContributors((prev) => prev.filter((_, i) => i !== index));
  }

  function removeCoAuthor(index: number) {
    setCoAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  const onSubmitInfo = async (data: InfoForm) => {
    setInfoError("");
    setInfoSaved(false);
    try {
      // Resolve the picked size to its actual mm values here so the request
      // always carries a consistent {printFormatKey, printWidthMm,
      // printHeightMm} triplet -- the backend only auto-derives a size from
      // genre when the book has none on record yet, so an explicit save
      // here is what makes this selector actually independent of genre
      // (apps/api book.ts PATCH handler).
      const format = PRINT_FORMATS[data.printFormatKey as PrintFormatKey] ?? PRINT_FORMATS.standard;

      // A filled-in ПІБ/contributor draft that was never explicitly "added"
      // via its own small button looked saved (the text sits right there in
      // the fields) but silently never reached bookAuthors/contributors --
      // every book on prod had bookAuthors: null despite authors typing a
      // name, confirmed via direct DB check. Folding a valid draft into the
      // save here (same non-empty check as addBookAuthor/addContributor)
      // means "Зберегти зміни" alone is enough, matching what typing into a
      // visible field and saving the form actually implies.
      const draftAuthor =
        newAuthor.lastName.trim() && newAuthor.firstName.trim()
          ? [{
              lastName: newAuthor.lastName.trim(),
              firstName: newAuthor.firstName.trim(),
              middleName: newAuthor.middleName?.trim() || undefined,
              photoUrl: newAuthor.photoUrl?.trim() || undefined,
            }]
          : [];
      const effectiveBookAuthors = [...bookAuthors, ...draftAuthor];

      const draftContributor =
        newContributor.role.trim() && newContributor.name.trim()
          ? [{ role: newContributor.role.trim(), name: newContributor.name.trim() }]
          : [];
      const effectiveContributors = [...contributors, ...draftContributor];

      const { book: updated } = await apiFetch<{ book: MetadataBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          subtitle: data.subtitle || null,
          description: data.description || null,
          genre: data.genre || null,
          printFormatKey: format.key,
          printWidthMm: format.widthMm,
          printHeightMm: format.heightMm,
          ageRating: data.ageRating || null,
          language: data.language,
          aiGenerated: data.aiGenerated ?? false,
          aiGeneratedNote: data.aiGenerated ? (data.aiGeneratedNote || null) : null,
          coAuthors: coAuthors.length > 0 ? coAuthors : null,
          bookAuthors: effectiveBookAuthors.length > 0 ? effectiveBookAuthors : null,
          contributors: effectiveContributors.length > 0 ? effectiveContributors : null,
          authorBio: authorBio.trim() || null,
          copyrightYear: data.copyrightYear?.trim() || null,
          copyrightHolder: data.copyrightHolder?.trim() || null,
          priorPublicationCertificate: data.priorPublicationCertificate?.trim() || null,
        }),
      });
      setBook(updated);
      setCoAuthors(Array.isArray(updated.coAuthors) ? updated.coAuthors : []);
      setBookAuthors(Array.isArray(updated.bookAuthors) ? updated.bookAuthors : []);
      setContributors(Array.isArray(updated.contributors) ? updated.contributors : []);
      setAuthorBio(updated.authorBio ?? "");
      // Біографія автора is meant to stay a single source of truth with
      // Налаштування профілю (author's explicit request) -- best-effort,
      // doesn't block/fail the book save if this secondary write fails.
      if ((updated.authorBio ?? "") !== (userProfile?.bio ?? "")) {
        apiFetch("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({ bio: updated.authorBio ?? "" }),
        })
          .then(() => setUserProfile((p) => (p ? { ...p, bio: updated.authorBio ?? "" } : p)))
          .catch(() => {});
      }
      if (draftAuthor.length > 0) setNewAuthor({ lastName: "", firstName: "", middleName: "", photoUrl: "" });
      if (draftContributor.length > 0) setNewContributor({ role: "", name: "" });
      setJustStagedFields(
        [
          updated.pendingTitle != null && "назву",
          updated.pendingDescription != null && "анотацію",
          updated.pendingGenre != null && "жанр",
        ].filter(Boolean) as string[]
      );
      setInfoSaved(true);
    } catch (e: any) {
      setInfoError(e.message || "Помилка збереження");
    }
  };

  async function claimIsbn() {
    const isbn = claimIsbnValue.trim();
    if (!isbn || !claimIsbnAttested) return;
    setClaimIsbnError("");
    setClaimIsbnSaving(true);
    try {
      const { book: updated } = await apiFetch<{ book: MetadataBook }>(`/api/books/${id}/claim-isbn`, {
        method: "PATCH",
        body: JSON.stringify({ isbn }),
      });
      setBook(updated);
      setClaimIsbnValue("");
    } catch (e: any) {
      setClaimIsbnError(e.message || "Не вдалося зберегти ISBN");
    } finally {
      setClaimIsbnSaving(false);
    }
  }

  const onSubmitPrice = async (data: PriceForm) => {
    setPriceError("");
    setPriceSaved(false);
    try {
      const { book: updated } = await apiFetch<{ book: MetadataBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          pricePrintBw: data.pricePrintBw ? Number(data.pricePrintBw) : null,
          pricePrintHardcoverBw: data.pricePrintHardcoverBw ? Number(data.pricePrintHardcoverBw) : null,
        }),
      });
      setBook(updated);
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 3000);
    } catch (e: any) {
      setPriceError(e.message || "Помилка збереження");
    }
  };

  // T-2075 -- one save action for the merged "Ціна та розповсюдження"
  // section: derives the concrete Ulit-anchored priceEbook/pricePrint/
  // pricePrintHardcover from the two royalty inputs (same helper BookWizard's
  // step 2 uses, computeAnchorPrices in FormatsAndDistribution.tsx, so the
  // formula can't drift between the two places), then saves both the price
  // PATCH and the distributionChannels PATCH together -- they're one
  // decision now, not two.
  const [formatsSaving, setFormatsSaving] = useState(false);
  const [formatsSaved, setFormatsSaved] = useState(false);
  const [formatsError, setFormatsError] = useState("");

  async function saveFormatsAndDistribution() {
    setFormatsError("");
    setFormatsSaving(true);
    try {
      const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
      const { book: updated } = await apiFetch<{ book: MetadataBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          desiredRoyaltyAmount: anchor.priceEbook !== undefined ? Number(royaltyEbook.replace(",", ".")) : null,
          desiredRoyaltyAmountPrint: anchor.pricePrint !== undefined ? Number(royaltyPrint.replace(",", ".")) : null,
          priceEbook: anchor.priceEbook ?? null,
          pricePrint: anchor.pricePrint ?? null,
          pricePrintHardcover: anchor.pricePrintHardcover ?? null,
        }),
      });
      setBook(updated);
      await apiFetch(`/api/books/${id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionChannels: channels }),
      });
      setFormatsSaved(true);
      setTimeout(() => setFormatsSaved(false), 3000);
    } catch (e: any) {
      setFormatsError(e.message || "Помилка збереження");
    } finally {
      setFormatsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Same readiness bar as the backend's own pre-publish gate
  // (apps/api/src/modules/books/publish.ts's validateBook) -- read from the
  // persisted book, not live form state, so a heading only turns green once
  // the section is actually saved, not just typed into.
  const infoSectionDone = (() => {
    const descLen = (book?.description ?? "").trim().length;
    return (
      !!book?.title?.trim() &&
      descLen >= DESCRIPTION_MIN_LENGTH &&
      descLen <= DESCRIPTION_MAX_LENGTH &&
      !!book?.ageRating
    );
  })();
  const fileSectionDone = !!(book?.originalDocxUrl || book?.pdfUrl || book?.epubUrl);
  const coverSectionDone = !!book?.coverUrl;
  const priceSectionDone = !!(
    book?.priceEbook ||
    book?.pricePrint ||
    book?.pricePrintHardcover ||
    book?.pricePrintBw ||
    book?.pricePrintHardcoverBw ||
    book?.desiredRoyaltyAmount ||
    book?.desiredRoyaltyAmountPrint
  );
  const readyToPublish = infoSectionDone && fileSectionDone && coverSectionDone && priceSectionDone;

  // Single source of truth for "is this section done" -- both the sticky
  // nav's checkbox (added so the author sees the whole scope of remaining
  // work without scrolling) and each section's own SectionHeading ✓/○ read
  // the SAME booleans here, so the two can never disagree with each other.
  const sectionDone: Record<(typeof SECTION_ORDER)[number], boolean> = {
    info: infoSectionDone,
    file: fileSectionDone,
    cover: coverSectionDone,
    price: priceSectionDone,
    review: readyToPublish,
    publish: readyToPublish,
  };

  // Which of the admin's rejection lines are STILL relevant, checked live
  // against the current field values (getUnresolvedRejectionLines) instead
  // of a "locallyFixed" flag that was set once on save and forgotten again
  // on the next page load -- that flag hid the banner/red border right
  // after saving, but reloading or navigating back re-derived everything
  // from the still-REJECTED moderationStatus with nothing tracking that the
  // flagged field had actually been fixed, so both reappeared. Per-line
  // resolution instead means a line (and any red ring tied to it) simply
  // stops showing once the field it's about has a value, and stays gone.
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const unresolvedCategory = (cat: (typeof unresolvedRejectionLines)[number]["category"]) =>
    unresolvedRejectionLines.some((l) => l.category === cat);
  // "Ще не виконано" per exact field this page can highlight, so a
  // rejection about e.g. genre only rings the Жанр select red -- not the
  // whole "Інформація" card, and not unrelated fields like Мова.
  const titleRejected = unresolvedCategory("title");
  const descriptionRejected = unresolvedCategory("description");
  const genreRejected = unresolvedCategory("genre");
  const authorRejected = unresolvedCategory("author");
  const languageRejected = unresolvedCategory("language");
  const priceCardRejected = unresolvedCategory("price");
  // The "Інформація" card's own blanket red border -- only for concerns that
  // actually live in that card (title/description/genre/author/language),
  // not price (its own card, see priceCardRejected) or cover/manuscript
  // (their own pages already show/monitor their own rejection banners).
  const infoCardRejected = titleRejected || descriptionRejected || genreRejected || authorRejected || languageRejected;
  const showRejection = infoCardRejected || priceCardRejected;
  const titleInvalid = titleValue.length > 0 && titleValue.length < 3;

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* T-2073 -- sticky header: title + anchor nav pinned together, not
            real tabs -- clicking a pill just scrolls to that section,
            everything below stays rendered and the single "Зберегти
            зміни"/publish flow from T-2060 is untouched. Previously only the
            <nav> itself was sticky and the <h1> sat above it in normal flow,
            so scrolling to any section (including "in the sky" landing --
            block:"start" against the *stuck* nav) still slid the title out
            of view above the viewport; the author (2026-08-18) confirmed
            it's the scroll-to-anchor jump, not a rendering bug, and asked to
            keep the whole header in sight. Grouping title+nav into one
            sticky block fixes it for every section, not just the first.
            Note (docs journal #11): `sticky` always opens a new stacking
            context -- if a fixed/modal element ever gets added inside one of
            the sections below, render it via a portal, not inline. */}
        <div className="sticky top-0 z-10 -mx-8 border-b bg-white px-8 pt-5 pb-2.5 shadow-sm">
          <h1 className="mb-2.5 text-lg font-semibold text-gray-900">Вихідні дані</h1>

          <nav className="flex gap-1 overflow-x-auto">
            {SECTION_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => scrollToSection(key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  activeSection === key
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {/* Read-only progress checkbox, not a real form control -- it
                    mirrors sectionDone (same booleans SectionHeading's ✓/○
                    below reads), it never toggles independently on click. A
                    solid fill in both states (not just a border) -- a thin
                    outline for "not done" barely registered against the
                    active pill's dark background, reading as "not
                    reacting" rather than as a distinct unchecked state. */}
                <span
                  aria-hidden
                  title={sectionDone[key] ? "Виконано" : "Ще не виконано"}
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-black leading-none",
                    sectionDone[key] ? "bg-green-500 text-white" : "bg-gray-300 text-transparent"
                  )}
                >
                  ✓
                </span>
                {SECTION_LABELS[key]}
              </button>
            ))}

            {/* T-2074 -- "Замовити тираж" is Ridero's own separate page
                (`/publish/print`, live-verified), not a section of this one --
                kept visually apart from the scroll-anchor pills (divider +
                real navigation, not scrollToSection) since it leaves this
                page entirely. First concrete step toward splitting these
                sections into their own routes, per the "тираж" observation. */}
            <span className="mx-1 shrink-0 self-center text-gray-200">|</span>
            <Link
              href={`/dashboard/books/${id}/print-order`}
              className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Замовити тираж
            </Link>
          </nav>
        </div>

        {showRejection && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="mb-1.5 font-medium">Модератор зазначив зауваження щодо метаданих:</p>
            <div className="space-y-0.5">
              {/* Only STILL-unresolved lines -- a line disappears here the
                  moment its own field gets a value (isRejectionLineResolved),
                  it doesn't wait for a page reload or the admin's next
                  review. */}
              {unresolvedRejectionLines.map((l, i) => {
                const target = resolveRejectionLineSection(l.text);
                if (target === "cover-page") {
                  return (
                    <Link
                      key={i}
                      href={`/dashboard/books/${id}/cover`}
                      className="block whitespace-pre-wrap underline decoration-red-300 hover:decoration-red-600"
                    >
                      {l.text}
                    </Link>
                  );
                }
                if (target) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => jumpToRejectionTarget(target)}
                      className="block whitespace-pre-wrap text-left underline decoration-red-300 hover:decoration-red-600"
                    >
                      {l.text}
                    </button>
                  );
                }
                return (
                  <p key={i} className="whitespace-pre-wrap">
                    {l.text}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        <section
          id="section-info"
          ref={(el) => { sectionRefs.current.info = el; }}
          className={cn("scroll-mt-28 space-y-3 rounded-xl transition-shadow", highlightSection === "info" && "ring-2 ring-yellow-400 ring-offset-2")}
        >
          <SectionHeading label={SECTION_LABELS.info} done={sectionDone.info} />
          <div className={cn("rounded-xl bg-white p-6 shadow-sm", infoCardRejected || titleInvalid ? "border-2 border-red-400" : "border")}>
            <form onSubmit={infoForm.handleSubmit(onSubmitInfo)} className="space-y-5">
              {/* Назва/Підзаголовок/Анотація зліва (усі поля самого тексту
                  книги, стовпчиком) — жанр/розмір/мова/вік справа: коротші
                  вибіркові поля в одному стовпчику. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="title">Назва <span className="text-red-500">*</span></Label>
                      <span className={cn("text-xs", titleInvalid ? "text-red-500 font-medium" : "text-gray-400")}>
                        {titleValue.length}/255 {titleInvalid && "(мін. 3)"}
                      </span>
                    </div>
                    <Input
                      id="title"
                      {...infoForm.register("title")}
                      className={cn(titleInvalid || titleRejected ? "border-red-400 focus-visible:ring-red-300" : "")}
                    />
                    {infoForm.formState.errors.title && (
                      <p className="text-sm text-red-500">{infoForm.formState.errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subtitle">Підзаголовок</Label>
                    <Input id="subtitle" {...infoForm.register("subtitle")} placeholder="Наприклад: збірка оповідань" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="description">Анотація <span className="text-red-500">*</span></Label>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          descValue.length > 0 && (descValue.length < DESCRIPTION_MIN_LENGTH || descValue.length > DESCRIPTION_MAX_LENGTH)
                            ? "text-red-500"
                            : "text-gray-400"
                        )}
                      >
                        {descValue.length}/{DESCRIPTION_MAX_LENGTH} (від {DESCRIPTION_MIN_LENGTH} до {DESCRIPTION_MAX_LENGTH})
                      </span>
                    </div>
                    <textarea
                      id="description"
                      {...infoForm.register("description")}
                      rows={9}
                      className={cn(
                        "flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 resize-none",
                        infoForm.formState.errors.description || descriptionRejected
                          ? "border-red-400 focus-visible:ring-red-300"
                          : "border-input focus-visible:ring-ring"
                      )}
                      placeholder={`Розкажіть читачам про вашу книгу… (від ${DESCRIPTION_MIN_LENGTH} до ${DESCRIPTION_MAX_LENGTH} символів)`}
                    />
                    {infoForm.formState.errors.description && (
                      <p className="text-sm text-red-500">{infoForm.formState.errors.description.message}</p>
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      {DESCRIPTION_PLATFORM_TARGETS.map((p) => {
                        const reached = descValue.length >= p.minChars;
                        return (
                          <span
                            key={p.key}
                            title={`${p.label}: рекомендовано від ${p.minChars} символів`}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium transition-colors",
                              reached ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"
                            )}
                          >
                            {reached ? "✓ " : ""}
                            {p.label} {p.minChars}+
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="genre">Жанр</Label>
                    <select
                      id="genre"
                      {...infoForm.register("genre")}
                      className={cn(
                        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        genreRejected ? "border-red-400" : "border-input"
                      )}
                    >
                      <option value="">Оберіть жанр</option>
                      {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="printFormatKey">Розмір книги <span className="text-red-500">*</span></Label>
                    <select
                      id="printFormatKey"
                      {...infoForm.register("printFormatKey")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {PRINT_FORMAT_KEYS.map((key) => {
                        const f = PRINT_FORMATS[key];
                        return (
                          <option key={key} value={key}>
                            {f.label} ({f.widthMm}×{f.heightMm}мм)
                          </option>
                        );
                      })}
                    </select>
                    <p className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
                      📐 Друкована версія книги матиме розмір{" "}
                      <span className="font-semibold text-gray-900">{displayFormat.widthMm}×{displayFormat.heightMm}мм</span>
                      {" "}({displayFormat.label.toLowerCase()})
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="language">
                      Мова книги <span className="text-red-500">*</span>
                      <span className="ml-1.5 text-xs font-normal text-gray-400">(потрібна для Amazon, Google Play)</span>
                    </Label>
                    <select
                      id="language"
                      {...infoForm.register("language")}
                      className={cn(
                        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        languageRejected ? "border-red-400" : "border-input"
                      )}
                    >
                      <option value="uk">🇺🇦 Українська</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="pl">🇵🇱 Polski</option>
                      <option value="es">🇪🇸 Español</option>
                      <option value="it">🇮🇹 Italiano</option>
                      <option value="pt">🇵🇹 Português</option>
                      <option value="ru">Русский</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ageRating">Вікові обмеження <span className="text-red-500">*</span></Label>
                    <select
                      id="ageRating"
                      {...infoForm.register("ageRating")}
                      className={cn(
                        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2",
                        infoForm.formState.errors.ageRating
                          ? "border-red-400 focus-visible:ring-red-300"
                          : "border-input focus-visible:ring-ring"
                      )}
                    >
                      <option value="">Оберіть вікове обмеження</option>
                      {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {infoForm.formState.errors.ageRating && (
                      <p className="text-sm text-red-500">{infoForm.formState.errors.ageRating.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* T-2060 п.4 — структуровані автори книги, незалежно від профілю користувача.
                  Знову повношириннi блоки один під одним (не 2 колонки) — так було
                  до попереднього редизайну. */}
              <div className={cn("space-y-2 rounded-lg border p-3", authorRejected && "border-2 border-red-400")}>
                  <Label>Автори книги</Label>
                  <p className="text-xs text-gray-400">
                    Якщо авторів декілька — кожен додає власне прізвище/ім&apos;я і, за бажанням, своє фото.
                  </p>
                  {bookAuthors.length > 0 && (
                    <div className="space-y-1.5">
                      {bookAuthors.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-sm">
                          {a.photoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                          )}
                          <span className="flex-1">
                            {a.lastName} {a.firstName} {a.middleName || ""}
                          </span>
                          <button type="button" onClick={() => removeBookAuthor(i)} className="text-gray-400 hover:text-red-600">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input
                      value={newAuthor.lastName}
                      onChange={(e) => setNewAuthor((p) => ({ ...p, lastName: e.target.value }))}
                      placeholder="Прізвище"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={newAuthor.firstName}
                      onChange={(e) => setNewAuthor((p) => ({ ...p, firstName: e.target.value }))}
                      placeholder="Ім'я"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={newAuthor.middleName}
                      onChange={(e) => setNewAuthor((p) => ({ ...p, middleName: e.target.value }))}
                      placeholder="По батькові"
                      className="h-9 text-sm"
                    />
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Input
                        value={newAuthor.photoUrl}
                        onChange={(e) => setNewAuthor((p) => ({ ...p, photoUrl: e.target.value }))}
                        placeholder="URL фото (необов'язково)"
                        className="h-9 flex-1 text-sm"
                      />
                      <input
                        ref={authorPhotoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleAuthorPhotoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 px-2.5 text-xs"
                        loading={authorPhotoUploading}
                        onClick={() => authorPhotoInputRef.current?.click()}
                      >
                        Завантажити фото
                      </Button>
                    </div>
                  </div>
                  {authorPhotoError && <p className="text-xs text-red-500">{authorPhotoError}</p>}

                  {/* T-2060 п.6 — канонічне джерело тексту біографії; показується й
                      редагується вживу на обкладинці */}
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="authorBio">Біографія автора</Label>
                    <textarea
                      id="authorBio"
                      value={authorBio}
                      onChange={(e) => setAuthorBio(e.target.value)}
                      rows={3}
                      placeholder="Наприклад: Валентина Островська народилась у…"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>

                  <Button type="button" variant="outline" size="sm" onClick={addBookAuthor}>+ Додати автора</Button>
                </div>

                {/* T-2060 п.5 — окрема сутність, не змішана з авторами */}
                <div className="space-y-2 rounded-lg border p-3">
                  <Label>Над книгою працювали</Label>
                  <p className="text-xs text-gray-400">Редактор, ілюстратор, дизайнер обкладинки тощо.</p>
                  {contributors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {contributors.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                          {c.role}: {c.name}
                          <button type="button" onClick={() => removeContributor(i)} className="text-gray-400 hover:text-red-600">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newContributor.role}
                      onChange={(e) => setNewContributor((p) => ({ ...p, role: e.target.value }))}
                      placeholder="Роль (напр. редактор)"
                      className="h-9 w-40 shrink-0 text-sm"
                    />
                    <Input
                      value={newContributor.name}
                      onChange={(e) => setNewContributor((p) => ({ ...p, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addContributor(); } }}
                      placeholder="Ім'я"
                      className="h-9 flex-1 min-w-0 text-sm"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addContributor} className="shrink-0">+ Додати</Button>
                  </div>
                </div>

              {/* Тільки для книги, яка вже була опублікована десь ще (напр.
                  proza.ru/stihi.ru) до приєднання до ULIT -- більшість
                  авторів це поле не заповнюють взагалі. */}
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label>Авторське право / попередня публікація</Label>
                  <p className="text-xs text-gray-400">
                    Заповнюйте, лише якщо книга вже виходила раніше на іншій платформі — до приєднання до ULIT.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[100px_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="copyrightYear" className="text-xs font-normal text-gray-500">Рік</Label>
                    <Input id="copyrightYear" {...infoForm.register("copyrightYear")} placeholder="2013" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="copyrightHolder" className="text-xs font-normal text-gray-500">Власник авторського права</Label>
                    <Input
                      id="copyrightHolder"
                      {...infoForm.register("copyrightHolder")}
                      placeholder="Наприклад: Валентина Островська"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priorPublicationCertificate" className="text-xs font-normal text-gray-500">
                    Номер свідоцтва про публікацію
                  </Label>
                  <Input
                    id="priorPublicationCertificate"
                    {...infoForm.register("priorPublicationCertificate")}
                    placeholder="Наприклад: №113122609908"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="border-t pt-3 space-y-1.5">
                  <Label htmlFor="claimIsbn" className="text-xs font-normal text-gray-500">
                    ISBN, вже присвоєний книзі раніше
                  </Label>
                  {book?.isbn ? (
                    <p className="flex items-center gap-2 rounded-md bg-green-50 px-2.5 py-1.5 text-sm text-green-700">
                      <span>✓</span>
                      {book.isbn}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          id="claimIsbn"
                          value={claimIsbnValue}
                          onChange={(e) => setClaimIsbnValue(e.target.value)}
                          placeholder="978-5-4474-2357-5"
                          className="h-9 flex-1 text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0"
                          loading={claimIsbnSaving}
                          disabled={!claimIsbnAttested || !claimIsbnValue.trim()}
                          onClick={claimIsbn}
                        >
                          Зберегти ISBN
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400">
                        Лише якщо книга вже мала власний ISBN до ULIT — стане ISBN цієї книги, реєстрація в
                        Книжковій палаті через ULIT більше не знадобиться.
                      </p>
                      {/* Платформа не звіряє номер із жодним зовнішнім реєстром ISBN --
                          явне підтвердження автора зсуває відповідальність на нього,
                          той самий підхід, що й у KDP/IngramSpark при "own ISBN". */}
                      <label className="flex items-start gap-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={claimIsbnAttested}
                          onChange={(e) => setClaimIsbnAttested(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300"
                        />
                        Підтверджую, що цей ISBN дійсно раніше офіційно присвоєно саме цій книзі, і я несу
                        відповідальність за коректність цих даних.
                      </label>
                      {claimIsbnError && <p className="text-xs text-red-500">{claimIsbnError}</p>}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" {...infoForm.register("aiGenerated")} className="rounded border-gray-300" />
                  Текст (або обкладинку) частково/повністю створено за допомогою ШІ
                </label>
                {aiGeneratedValue && (
                  <textarea
                    {...infoForm.register("aiGeneratedNote")}
                    rows={2}
                    placeholder="Уточніть, що саме створено за допомогою ШІ (необов'язково)"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                )}
              </div>

              {infoError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{infoError}</div>
              )}
              {infoSaved && (
                <div
                  className={cn(
                    "relative rounded-md p-3 pr-8 text-sm",
                    justStagedFields.length > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setInfoSaved(false)}
                    aria-label="Закрити"
                    className={cn(
                      "absolute right-2 top-2 leading-none hover:opacity-70",
                      justStagedFields.length > 0 ? "text-amber-500" : "text-green-500"
                    )}
                  >
                    ×
                  </button>
                  {justStagedFields.length > 0 ? (
                    <>
                      ✓ Збережено як чернетку
                      <span className="block text-xs text-amber-600 mt-0.5">
                        Книга вже опублікована на сайті — зміни в {justStagedFields.join(", ")} ще НЕ з&apos;являться там, доки ви не
                        натиснете «Опублікувати із змінами» нижче і адмін не підтвердить. Решта полів (ціна, формати, автори тощо)
                        оновилась одразу.
                      </span>
                    </>
                  ) : (
                    <>
                      ✓ Збережено
                      {book?.status === "REVIEW" && (
                        <span className="block text-xs text-green-600 mt-0.5">
                          Книга на модерації — модератор побачить ці зміни одразу, повторно надсилати на модерацію не потрібно.
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              <Button type="submit" loading={infoForm.formState.isSubmitting}>
                Зберегти зміни
              </Button>
            </form>
          </div>
        </section>

        <section
          id="section-file"
          ref={(el) => { sectionRefs.current.file = el; }}
          className={cn("scroll-mt-28 space-y-3 rounded-xl transition-shadow", highlightSection === "file" && "ring-2 ring-yellow-400 ring-offset-2")}
        >
          <SectionHeading label={SECTION_LABELS.file} done={sectionDone.file} />
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-1">Рукопис (.docx)</h3>
              <p className="text-xs text-gray-500">Завантажте файл або замініть уже завантажений.</p>
            </div>
            <DocxUploader
              bookId={id}
              currentDocxUrl={book?.originalDocxUrl}
              onUploadSuccess={() => setBook((b) => (b ? { ...b, originalDocxUrl: "uploaded" } : b))}
            />
            <Link
              href={`/dashboard/books/${id}/manuscript`}
              className="inline-block text-sm text-black underline hover:no-underline"
            >
              Редагувати текст рукопису →
            </Link>
          </div>
        </section>

        {/* Without its own section here, authors routinely skipped straight
            to "Надіслати на модерацію" with no cover at all -- admin kept
            bouncing the same books back for doopracyuvannya. A dedicated,
            checklist-styled block (✓/○, same language as
            IsbnReadinessChecklist below) makes the missing step visible
            instead of only surfacing as a rejection after the fact. */}
        <section
          id="section-cover"
          ref={(el) => { sectionRefs.current.cover = el; }}
          className={cn("scroll-mt-28 space-y-3 rounded-xl transition-shadow", highlightSection === "cover" && "ring-2 ring-yellow-400 ring-offset-2")}
        >
          <SectionHeading label={SECTION_LABELS.cover} done={sectionDone.cover} />
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <span className={cn("mt-0.5", book?.coverUrl ? "text-green-600" : "text-amber-500")}>
                {book?.coverUrl ? "✓" : "○"}
              </span>
              <span className={book?.coverUrl ? "text-gray-700" : "text-gray-500"}>
                {book?.coverUrl ? "Обкладинка завантажена" : "Обкладинка ще не створена"}
                {!book?.coverUrl && (
                  <span className="block text-xs text-amber-600">
                    Обов&apos;язково для модерації — без обкладинки адмін поверне книгу на доопрацювання.
                  </span>
                )}
              </span>
            </div>
            <Link
              href={`/dashboard/books/${id}/cover`}
              className="inline-block text-sm text-black underline hover:no-underline"
            >
              {book?.coverUrl ? "Редагувати обкладинку →" : "Створити обкладинку →"}
            </Link>
          </div>
        </section>

        <section
          id="section-price"
          ref={(el) => { sectionRefs.current.price = el; }}
          className={cn("scroll-mt-28 space-y-3 rounded-xl transition-shadow", highlightSection === "price" && "ring-2 ring-yellow-400 ring-offset-2")}
        >
          <SectionHeading label={SECTION_LABELS.price} done={sectionDone.price} />
          <div className={cn("rounded-xl bg-white p-6 shadow-sm space-y-5", priceCardRejected ? "border-2 border-red-400" : "border")}>
            <FormatsAndDistribution
              language={book?.language}
              formatLabel={`${displayFormat.widthMm}×${displayFormat.heightMm}мм (${PRINT_FORMATS[displayFormat.key as keyof typeof PRINT_FORMATS]?.label ?? "Стандартний"})`}
              pageCount={book?.printPageCount ?? book?.pageCount}
              printCost={printCost}
              channels={channels}
              onToggleChannel={toggleChannel}
              royaltyEbook={royaltyEbook}
              onRoyaltyEbookChange={setRoyaltyEbook}
              royaltyPrint={royaltyPrint}
              onRoyaltyPrintChange={setRoyaltyPrint}
            />

            {formatsError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formatsError}</div>
            )}
            {formatsSaved && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
            )}
            <Button onClick={saveFormatsAndDistribution} loading={formatsSaving}>
              Зберегти зміни
            </Button>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <form onSubmit={priceForm.handleSubmit(onSubmitPrice)} className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Чорно-білий друк</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Дешевше в типографії, опційно — заповніть, якщо хочете запропонувати покупцю дешевший варіант
                  поруч із кольоровим. Пряма ціна для покупця, без калькулятора гонорару.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pricePrintBw">Друк ч/б, м&apos;яка (грн)</Label>
                  <Input
                    id="pricePrintBw"
                    type="number"
                    step="0.01"
                    min="0"
                    {...priceForm.register("pricePrintBw")}
                    placeholder="149.99"
                  />
                  {priceForm.formState.errors.pricePrintBw && (
                    <p className="text-xs text-red-500">{priceForm.formState.errors.pricePrintBw.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricePrintHardcoverBw">Друк ч/б, тверда (грн)</Label>
                  <Input
                    id="pricePrintHardcoverBw"
                    type="number"
                    step="0.01"
                    min="0"
                    {...priceForm.register("pricePrintHardcoverBw")}
                    placeholder="229.99"
                  />
                  {priceForm.formState.errors.pricePrintHardcoverBw && (
                    <p className="text-xs text-red-500">{priceForm.formState.errors.pricePrintHardcoverBw.message}</p>
                  )}
                </div>
              </div>

              {priceError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{priceError}</div>
              )}
              {priceSaved && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
              )}

              <Button type="submit" variant="outline" loading={priceForm.formState.isSubmitting}>
                Зберегти ч/б ціни
              </Button>
            </form>
          </div>

          {book?.status === "PUBLISHED" && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <KdpSelectPanel bookId={id} bookStatus={book.status} />
            </div>
          )}
        </section>

        <section
          id="section-review"
          ref={(el) => { sectionRefs.current.review = el; }}
          className="scroll-mt-28 space-y-3"
        >
          <SectionHeading label={SECTION_LABELS.review} done={sectionDone.review} />
          <div className="space-y-6">
            <div className="rounded-xl border bg-gray-50 p-5 space-y-3 text-sm">
              <Row label="Назва" value={book?.title || "—"} />
              {book?.isbn && <Row label="ISBN" value={book.isbn} />}
              <Row label="Жанр" value={book?.genre || "—"} />
              <Row label="Розмір книги" value={`${displayFormat.label} (${displayFormat.widthMm}×${displayFormat.heightMm}мм)`} />
              {/* printPageCount (from the live generate-pdf-print.ts print job) is
                  the real source of truth -- pageCount is only ever set by the
                  retired PAGE_THUMBNAILS job that nothing in the current publish
                  flow triggers anymore, so it stays null forever for every book
                  published through today's pipeline (same fallback order as
                  distribute/page.tsx's effectivePageCount). */}
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
            </div>

            {book?.pricePrint || book?.pricePrintHardcover || book?.pricePrintBw || book?.pricePrintHardcoverBw ? (
              <IsbnReadinessChecklist book={book} bookAuthors={bookAuthors} bookId={id} />
            ) : null}

            {!!book?.distributionChannels?.length && (
              <div className="rounded-xl border bg-white p-5 space-y-4 text-sm">
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
              </div>
            )}

            {/* Preview excerpt — only for books with EPUB */}
            {book?.epubUrl && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold mb-1">Уривок для читачів</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Встановіть діапазон сторінок, які покупці зможуть прочитати безкоштовно.
                </p>
                <PreviewRangeEditor
                  bookId={id}
                  pageCount={book?.pageCount}
                  initialStart={book?.previewStart}
                  initialEnd={book?.previewEnd}
                  onSaved={(start, end) =>
                    setBook((b) => (b ? { ...b, previewStart: start, previewEnd: end } : b))
                  }
                />
              </div>
            )}

          </div>
        </section>

        {/* T-2060 п.7 -- single-scroll layout ends with the actual publish
            action, matching Ridero's one-page publish/info + publish/instore
            flow (docs/T-2060-publish-info-redesign-checklist.md). */}
        <section
          id="section-publish"
          ref={(el) => { sectionRefs.current.publish = el; }}
          className="scroll-mt-28 space-y-3"
        >
          <SectionHeading label={SECTION_LABELS.publish} done={sectionDone.publish} />
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
            <PublishButton
              bookId={id}
              bookStatus={book?.status ?? ""}
              onSubmitted={() => setBook((b) => (b ? { ...b, status: "REVIEW" } : b))}
            />
            {/* PublishButton's PUBLISHED branch is just a static badge -- for
                a live book, editing Назва/Анотація/Жанр above stages the
                change (see onSubmitInfo) instead of publishing instantly, so
                the actual "send it live" action for THOSE fields is this
                button, not PublishButton. */}
            {book?.status === "PUBLISHED" && (
              <RepublishButton
                bookId={id}
                docxUpdatedAt={book?.docxUpdatedAt}
                publishedAt={book?.publishedAt}
                republishRequestedAt={book?.republishRequestedAt}
                pendingTitle={book?.pendingTitle}
                pendingDescription={book?.pendingDescription}
                pendingGenre={book?.pendingGenre}
                onSubmitted={(republishRequestedAt) =>
                  setBook((b) => (b ? { ...b, republishRequestedAt } : b))
                }
              />
            )}
          </div>
        </section>

        <div className="text-center pb-2">
          <Link
            href={`/dashboard/books/${id}`}
            className="text-sm text-gray-500 underline hover:no-underline hover:text-gray-900"
          >
            До дашборду книги →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default OutputDataContent;
