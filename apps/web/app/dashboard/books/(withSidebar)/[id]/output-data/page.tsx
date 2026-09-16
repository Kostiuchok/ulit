"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import {
  PRINT_FORMATS,
  PRINT_FORMAT_KEYS,
  resolveBookPrintFormat,
  isPublishStepComplete,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  AGE_RATINGS,
  ageRatingSchema,
  GENRES,
  genreSchema,
  toOptionalSelectField,
  LANGUAGES,
  languageSchema,
  bookAuthorSchema,
  type PrintFormatKey,
} from "shared-types";

// Each external platform's own annotation-length recommendation -- kept in
// sync manually with admin/books/[id]/distribute/page.tsx's per-platform
// checklist (same numbers, "desc" check per platform). Ulit's own gate
// (120-500) is the only thing that actually blocks /publish; these are
// informational -- live badges here let the author see, while typing, which
// stores their annotation is already long enough for.
const DESCRIPTION_PLATFORM_TARGETS = [
  { key: "d2d", label: "D2D", minChars: 50 },
  { key: "udk", label: "УДК", minChars: DESCRIPTION_MIN_LENGTH },
  { key: "google", label: "Google Play", minChars: 150 },
  { key: "kdp", label: "Amazon KDP", minChars: 250 },
] as const;

const infoSchema = z.object({
  // min(1), not min(3) -- matches every OTHER place a title gets validated
  // (apps/api's POST/PATCH, BookWizard step 1).
  title: z.string().min(1, "Назва обов'язкова").max(255),
  subtitle: z.string().max(255).optional(),
  description: z
    .string()
    .min(DESCRIPTION_MIN_LENGTH, `Анотація має містити щонайменше ${DESCRIPTION_MIN_LENGTH} символів`)
    .max(DESCRIPTION_MAX_LENGTH, `Анотація має містити не більше ${DESCRIPTION_MAX_LENGTH} символів`),
  genre: toOptionalSelectField(genreSchema),
  printFormatKey: z.enum(PRINT_FORMAT_KEYS as [PrintFormatKey, ...PrintFormatKey[]], {
    errorMap: () => ({ message: "Оберіть розмір книги" }),
  }),
  ageRating: toOptionalSelectField(ageRatingSchema),
  language: languageSchema,
  aiGenerated: z.boolean().optional(),
  aiGeneratedNote: z.string().max(1000).optional(),
  copyrightYear: z.string().max(4).optional(),
  copyrightHolder: z.string().max(255).optional(),
  priorPublicationCertificate: z.string().max(100).optional(),
});
type InfoForm = z.infer<typeof infoSchema>;

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

interface InfoBook {
  status?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  ageRating?: string | null;
  language: string;
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  aiGenerated?: boolean;
  aiGeneratedNote?: string | null;
  coAuthors?: CoAuthor[] | null;
  bookAuthors?: BookAuthor[] | null;
  contributors?: Contributor[] | null;
  authorBio?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  coverUrl?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  desiredRoyaltyAmountPrint?: number | string | null;
  isbn?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  copyrightYear?: string | null;
  copyrightHolder?: string | null;
  priorPublicationCertificate?: string | null;
}

export default function OutputDataInfoPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, apiUpload, token } = useApi();
  const { book, setBook, loading } = useBook<InfoBook>(id);

  const [infoSaved, setInfoSaved] = useState(false);
  // Which sensitive fields (if any) the last save actually staged as
  // pending instead of publishing live -- drives the "✓ Збережено" note
  // right where the save happened, matching what RepublishButton shows on
  // the "Публікація" page.
  const [justStagedFields, setJustStagedFields] = useState<string[]>([]);
  const [infoError, setInfoError] = useState("");
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [authorPhotoUploading, setAuthorPhotoUploading] = useState(false);
  const [authorPhotoError, setAuthorPhotoError] = useState("");
  const [newAuthorError, setNewAuthorError] = useState("");
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
    if (!token) return;
    apiFetch<{ user: AccountProfile }>("/api/users/me")
      .then(({ user }) => setUserProfile(user))
      .catch(() => {});
  }, [token, apiFetch]);

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

  const infoForm = useForm<InfoForm>({ resolver: zodResolver(infoSchema) });

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
  // whenever the tab regains focus, which gives `book` a new object
  // reference on every such refetch; without this guard, that silent
  // refetch re-ran this whole effect and clobbered any unsaved typing with
  // whatever was still on the server.
  const bookHydratedRef = useRef(false);
  useEffect(() => {
    if (!book || bookHydratedRef.current) return;
    bookHydratedRef.current = true;
    setCoAuthors(Array.isArray(book.coAuthors) ? book.coAuthors : []);
    setBookAuthors(Array.isArray(book.bookAuthors) ? book.bookAuthors : []);
    setContributors(Array.isArray(book.contributors) ? book.contributors : []);
    setAuthorBio(book.authorBio ?? "");
    infoForm.reset({
      // Prefer the staged pending* value over the live one when this book is
      // PUBLISHED and has an unsent edit sitting in moderation limbo.
      title: book.pendingTitle ?? book.title,
      subtitle: book.subtitle ?? "",
      description: book.pendingDescription ?? book.description ?? "",
      genre: (book.pendingGenre ?? book.genre ?? "") as InfoForm["genre"],
      printFormatKey: resolveBookPrintFormat(book).key,
      ageRating: (book.ageRating ?? "") as InfoForm["ageRating"],
      language: book.language as InfoForm["language"],
      aiGenerated: book.aiGenerated ?? false,
      aiGeneratedNote: book.aiGeneratedNote ?? "",
      copyrightYear: book.copyrightYear ?? "",
      copyrightHolder: book.copyrightHolder ?? "",
      priorPublicationCertificate: book.priorPublicationCertificate ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  function addBookAuthor() {
    setNewAuthorError("");
    // Nothing typed at all -- treat as a no-op click, not a validation
    // error (matches the old behavior for an accidental/empty click).
    if (!newAuthor.lastName.trim() && !newAuthor.firstName.trim()) return;
    const result = bookAuthorSchema.safeParse({
      lastName: newAuthor.lastName.trim(),
      firstName: newAuthor.firstName.trim(),
      middleName: newAuthor.middleName?.trim() || undefined,
      photoUrl: newAuthor.photoUrl?.trim() || undefined,
    });
    if (!result.success) {
      setNewAuthorError(result.error.errors[0].message);
      return;
    }
    setBookAuthors((prev) => [...prev, result.data]);
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

  const onSubmitInfo = async (data: InfoForm) => {
    setInfoError("");
    setInfoSaved(false);
    try {
      // Resolve the picked size to its actual mm values here so the request
      // always carries a consistent {printFormatKey, printWidthMm,
      // printHeightMm} triplet.
      const format = PRINT_FORMATS[data.printFormatKey as PrintFormatKey] ?? PRINT_FORMATS.standard;

      // A filled-in ПІБ/contributor draft that was never explicitly "added"
      // via its own small button looked saved but silently never reached
      // bookAuthors/contributors -- folding a valid draft into the save here
      // means "Зберегти зміни" alone is enough.
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

      const { book: updated } = await apiFetch<{ book: InfoBook }>(`/api/books/${id}`, {
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
      const { book: updated } = await apiFetch<{ book: InfoBook }>(`/api/books/${id}/claim-isbn`, {
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

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  // Same PUBLISH_FIELD_CHECKS (shared-types) as the backend's own pre-publish
  // gate and as output-data/layout.tsx's own nav-badge derivation -- reads
  // from the persisted book, not live form state, so this heading only turns
  // green once the section is actually saved, not just typed into.
  const infoSectionDone = isPublishStepComplete("info", book ?? {});
  const hasAnyAuthor = Array.isArray(book?.bookAuthors) && book!.bookAuthors!.some((a) => a.lastName?.trim() && a.firstName?.trim());
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
  const infoCardRejected = titleRejected || descriptionRejected || genreRejected || authorRejected || languageRejected;

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.info} done={infoSectionDone && !infoCardRejected} />
      <div className={cn("rounded-xl bg-white p-6 shadow-sm", infoCardRejected ? "border-2 border-red-400" : "border")}>
        <form onSubmit={infoForm.handleSubmit(onSubmitInfo)} className="space-y-5">
          {/* Назва/Підзаголовок/Анотація зліва (усі поля самого тексту
              книги, стовпчиком) — жанр/розмір/мова/вік справа: коротші
              вибіркові поля в одному стовпчику. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Назва <span className="text-red-500">*</span></Label>
                  <span className={cn("text-xs", infoForm.formState.errors.title ? "text-red-500 font-medium" : "text-gray-400")}>
                    {titleValue.length}/255
                  </span>
                </div>
                <Input
                  id="title"
                  {...infoForm.register("title")}
                  className={cn(infoForm.formState.errors.title || titleRejected ? "border-red-400 focus-visible:ring-red-300" : "")}
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
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
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

          {/* T-2060 п.4 — структуровані автори книги, незалежно від профілю користувача. */}
          <div className={cn("space-y-2 rounded-lg border p-3", authorRejected && "border-2 border-red-400")}>
              <Label>Автори книги</Label>
              <p className="text-xs text-gray-400">
                Якщо авторів декілька — кожен додає власне прізвище/ім&apos;я і, за бажанням, своє фото.
              </p>
              <div className="flex items-start gap-2 text-xs">
                <span className={cn("mt-0.5", hasAnyAuthor ? "text-green-600" : "text-amber-500")}>
                  {hasAnyAuthor ? "✓" : "○"}
                </span>
                <span className={hasAnyAuthor ? "text-gray-500" : "text-amber-600"}>
                  {hasAnyAuthor
                    ? "Автор вказаний"
                    : "Обов'язково: додайте принаймні одного автора (прізвище + ім'я) нижче — без цього книгу не можна відправити на модерацію"}
                </span>
              </div>
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

              {newAuthorError && <p className="text-xs text-red-500">{newAuthorError}</p>}
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
    </div>
  );
}
