"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SaveActionButton } from "@/components/ui/SaveActionButton";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
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
  const { book, setBook, loading } = useBook<InfoBook>(id);

  // The form (and its useForm() call) only ever mounts once `book` exists,
  // so defaultValues are correct on OutputDataInfoForm's very first render
  // -- no async "hydrate the form after the fact" step, and therefore no
  // race with react-hook-form's own values/reset machinery to work around.
  // (Previously: hydration went through useForm's `values` option, fed by a
  // `hydratedBook` state latched via a ref-guarded effect. Confirmed live on
  // prod, direct React-internals inspection: `values` -- and a bare
  // reset(), and even an explicit setValue() called synchronously in the
  // same effect -- all update react-hook-form's internal _formValues
  // correctly but do NOT update `_fields[name]._f.value` for a
  // Controller-registered field, which is what Controller's own rendered
  // value AND zodResolver validation both actually read. Two real
  // consequences, not a cosmetic glitch: genre/printFormatKey/language/
  // ageRating/aiGenerated kept showing their empty placeholder despite real
  // saved data, and -- since printFormatKey/language are required in the
  // schema -- "Зберегти зміни" silently failed client-side validation and
  // never even reached the network on ANY edit, until the author manually
  // re-picked every one of those 5 fields by hand. Mounting the form only
  // once real data exists sidesteps the whole problem at the root instead
  // of chasing it with another reset-timing patch.)
  if (loading || !book) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  // Keyed by book id: without this, navigating client-side from one book's
  // "Вихідні дані" straight to another's (e.g. via the sidebar's book
  // switcher, same route pattern) would reuse this component instance
  // rather than remount it, leaving the form permanently stuck on the
  // FIRST book's defaultValues -- the same class of staleness the old
  // `hydratedBook`/ref-guard version had for exactly this navigation, just
  // via a different mechanism.
  return <OutputDataInfoForm key={id} book={book} bookId={id} setBook={setBook} />;
}

function OutputDataInfoForm({
  book,
  bookId: id,
  setBook,
}: {
  book: InfoBook;
  bookId: string;
  setBook: (book: InfoBook) => void;
}) {
  const { apiFetch, apiUpload, token } = useApi();

  const [infoSaved, setInfoSaved] = useState(false);
  // Fields outside react-hook-form (authors, bio, contributors) — T2.1 dirty.
  const [extraDirty, setExtraDirty] = useState(false);
  // Which sensitive fields (if any) the last save actually staged as
  // pending instead of publishing live -- drives the "✓ Збережено" note
  // right where the save happened, matching what RepublishButton shows on
  // the "Публікація" page.
  const [justStagedFields, setJustStagedFields] = useState<string[]>([]);
  const [infoError, setInfoError] = useState("");
  // Lazy initializers, not an effect -- `book` is already the real data by
  // the time this component ever mounts (see OutputDataInfoPage above), so
  // these are correct from the first render with no separate hydration step.
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>(() => (Array.isArray(book.coAuthors) ? book.coAuthors : []));
  const [authorPhotoUploading, setAuthorPhotoUploading] = useState(false);
  const [authorPhotoError, setAuthorPhotoError] = useState("");
  const [newAuthorError, setNewAuthorError] = useState("");
  const authorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [bookAuthors, setBookAuthors] = useState<BookAuthor[]>(() => (Array.isArray(book.bookAuthors) ? book.bookAuthors : []));
  const [newAuthor, setNewAuthor] = useState<BookAuthor>({ lastName: "", firstName: "", middleName: "", photoUrl: "" });
  const [contributors, setContributors] = useState<Contributor[]>(() => (Array.isArray(book.contributors) ? book.contributors : []));
  const [newContributor, setNewContributor] = useState<Contributor>({ role: "", name: "" });
  const [authorBio, setAuthorBio] = useState(() => book.authorBio ?? "");

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
    if (!userProfile || profileAutofillApplied.current) return;
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

  // `book` is real data on this component's very first render (see
  // OutputDataInfoPage above) -- defaultValues are correct from the start,
  // for every field including the Controller-wrapped Selects/Checkbox
  // (genre/printFormatKey/language/ageRating/aiGenerated), with no separate
  // hydration step and nothing to re-sync later.
  const infoForm = useForm<InfoForm>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      // Prefer the staged pending* value over the live one when this book
      // is PUBLISHED and has an unsent edit sitting in moderation limbo.
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
    },
  });

  const titleValue = infoForm.watch("title") ?? "";
  const descValue = infoForm.watch("description") ?? "";
  const aiGeneratedValue = infoForm.watch("aiGenerated") ?? false;
  // Live (watched) values, not the persisted `book.*` fields -- these drive
  // the amber "missing required value" highlight below, which has to react
  // to the author picking/clearing a value immediately, not just after save.
  const genreValue = infoForm.watch("genre") ?? "";
  const ageRatingValue = infoForm.watch("ageRating") ?? "";
  const languageValue = infoForm.watch("language") ?? "";
  const genreMissing = !genreValue;
  const ageRatingMissing = !ageRatingValue;
  const languageMissing = !languageValue;
  // Amber ring for "required but currently empty" -- deliberately distinct
  // from the red border used elsewhere on this page for "a moderator
  // rejected this exact field" (*Rejected below), so the two reasons stay
  // visually different.
  const missingRing = "border-amber-400 focus:ring-amber-300 ring-1 ring-amber-200";

  // Розмір книги is its own independent field now (not derived from genre)
  // -- same "Розмір книги" selector BookWizard's creation step has, so it
  // can be changed after creation too, not just once at the start.
  const selectedFormatKey = (infoForm.watch("printFormatKey") || "standard") as PrintFormatKey;
  const displayFormat = PRINT_FORMATS[selectedFormatKey] ?? PRINT_FORMATS.standard;

  // "Заповнити поля з кабінету автора" -- one-click recovery for the exact
  // scenario reported live: an author accidentally removes their only
  // bookAuthors entry, the badge correctly flips to amber, and this button
  // (next to it) copies ПІБ/фото from the account profile straight back into
  // the "add author" inputs so a single follow-up click on "+ Додати автора"
  // restores it -- 2 clicks total instead of retyping everything by hand.
  function fillAuthorFromProfile() {
    if (!userProfile) return;
    setNewAuthor({
      lastName: userProfile.lastName ?? "",
      firstName: userProfile.firstName ?? "",
      middleName: userProfile.patronymic ?? "",
      photoUrl: userProfile.avatarUrl ?? "",
    });
  }

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
    setExtraDirty(true);
    setInfoSaved(false);
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
    setExtraDirty(true);
    setInfoSaved(false);
  }

  function addContributor() {
    if (!newContributor.role.trim() || !newContributor.name.trim()) return;
    setContributors((prev) => [...prev, { role: newContributor.role.trim(), name: newContributor.name.trim() }]);
    setNewContributor({ role: "", name: "" });
    setExtraDirty(true);
    setInfoSaved(false);
  }

  function removeContributor(index: number) {
    setContributors((prev) => prev.filter((_, i) => i !== index));
    setExtraDirty(true);
    setInfoSaved(false);
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
      setExtraDirty(false);
      infoForm.reset(data);
      // output-data/layout.tsx's top nav pills (✓/○ badges) come from their
      // OWN separate useBook(id) instance, not this page's -- without this,
      // the "Інформація" pill stayed on its stale state after saving no
      // matter what, since layout.tsx never learned the save happened.
      window.dispatchEvent(new Event("ulit:books-changed"));
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

  // Same PUBLISH_FIELD_CHECKS (shared-types) as the backend's own pre-publish
  // gate and as output-data/layout.tsx's own nav-badge derivation -- reads
  // from the persisted book, not live form state, so this heading only turns
  // green once the section is actually saved, not just typed into.
  const infoSectionDone = isPublishStepComplete("info", book);
  // Live -- reads the `bookAuthors` state array this page actually renders
  // and lets the author add/remove from, not the persisted `book.bookAuthors`
  // from the last save. Reading the persisted value here was the exact bug
  // reported live: removing the only author left the "✓ Автор вказаний"
  // badge showing green (it hadn't been saved yet, so `book.bookAuthors`
  // still had the old entry) even though the section was no longer actually
  // complete. A draft still sitting in the "add author" inputs (not yet
  // clicked "+ Додати автора") also counts as present -- onSubmitInfo already
  // silently folds that same draft in on save, so treating it as "missing"
  // here would flash amber for a value that's about to be saved anyway.
  const authorDraftFilled = !!(newAuthor.lastName.trim() && newAuthor.firstName.trim());
  const hasAnyAuthor = bookAuthors.some((a) => a.lastName?.trim() && a.firstName?.trim()) || authorDraftFilled;
  const authorBioMissing = !authorBio.trim();
  const unresolvedRejectionLines = getUnresolvedRejectionLines(book);
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

  // Gates "Зберегти зміни" itself -- every required field this section has,
  // computed live off current form/state values (not the formState.errors
  // RHF only starts tracking after a first submit attempt under the default
  // "onSubmit" validation mode, which would leave the button clickable on a
  // freshly-opened page even with required fields still blank). Deliberately
  // does NOT include *Rejected (moderator flagged this field) -- a rejected
  // field still HAS a value, editing and re-saving it is exactly how an
  // author resolves a rejection, so rejection state must never block Save.
  const infoIncomplete =
    !titleValue.trim() ||
    descValue.trim().length < DESCRIPTION_MIN_LENGTH ||
    descValue.trim().length > DESCRIPTION_MAX_LENGTH ||
    genreMissing ||
    ageRatingMissing ||
    languageMissing ||
    !hasAnyAuthor ||
    authorBioMissing;
  const infoDirty = infoForm.formState.isDirty || extraDirty;
  const infoSaveState = infoForm.formState.isSubmitting
    ? "saving"
    : infoSaved && !infoDirty
      ? "saved"
      : "idle";

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.info} done={infoSectionDone && !infoCardRejected} />
      <Card className={cn("p-6 shadow-sm", infoCardRejected && "border-2 border-red-400")}>
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
                <Textarea
                  id="description"
                  {...infoForm.register("description")}
                  rows={9}
                  className={cn(
                    "resize-none",
                    (infoForm.formState.errors.description || descriptionRejected) && "border-red-400 focus-visible:ring-red-300"
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
                <Label htmlFor="genre">Жанр <span className="text-red-500">*</span></Label>
                <Controller
                  control={infoForm.control}
                  name="genre"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="genre"
                        className={cn(genreRejected ? "border-red-400" : genreMissing && missingRing)}
                      >
                        <SelectValue placeholder="Оберіть жанр" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="printFormatKey">Розмір книги <span className="text-red-500">*</span></Label>
                <Controller
                  control={infoForm.control}
                  name="printFormatKey"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="printFormatKey">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRINT_FORMAT_KEYS.map((key) => {
                          const f = PRINT_FORMATS[key];
                          return (
                            <SelectItem key={key} value={key}>
                              {f.label} ({f.widthMm}×{f.heightMm}мм)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
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
                <Controller
                  control={infoForm.control}
                  name="language"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="language"
                        className={cn(languageRejected ? "border-red-400" : languageMissing && missingRing)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ageRating">Вікові обмеження <span className="text-red-500">*</span></Label>
                <Controller
                  control={infoForm.control}
                  name="ageRating"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="ageRating" className={cn(ageRatingMissing && missingRing)}>
                        <SelectValue placeholder="Оберіть вікове обмеження" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          {/* T-2060 п.4 — структуровані автори книги, незалежно від профілю користувача. */}
          <div
            className={cn(
              "rounded-lg border p-3",
              authorRejected ? "border-2 border-red-400" : !hasAnyAuthor && "border-2 border-amber-400"
            )}
          >
            <CollapsibleSection
              title={<h3 className="text-base font-semibold text-gray-900">Автори книги <span className="text-red-500">*</span></h3>}
              description="Якщо авторів декілька — кожен додає власне прізвище/ім'я і, за бажанням, своє фото."
            >
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5 text-xs">
                <span className="flex items-start gap-2">
                  <span className={cn("mt-0.5", hasAnyAuthor ? "text-green-600" : "text-amber-500")}>
                    {hasAnyAuthor ? "✓" : "○"}
                  </span>
                  <span className={hasAnyAuthor ? "text-gray-500" : "text-amber-600"}>
                    {hasAnyAuthor
                      ? "Автор вказаний"
                      : "Автор не вказаний — без цього книгу не можна відправити на модерацію"}
                  </span>
                </span>
                {!hasAnyAuthor && (userProfile?.lastName || userProfile?.firstName) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-xs"
                    onClick={fillAuthorFromProfile}
                  >
                    Заповнити поля з кабінету автора
                  </Button>
                )}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBookAuthor(i)}
                        className="h-auto w-auto p-0 text-gray-400 hover:bg-transparent hover:text-red-600"
                      >
                        ×
                      </Button>
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
                <Label htmlFor="authorBio">Біографія автора <span className="text-red-500">*</span></Label>
                <Textarea
                  id="authorBio"
                  value={authorBio}
                  onChange={(e) => {
                    setAuthorBio(e.target.value);
                    setExtraDirty(true);
                    setInfoSaved(false);
                  }}
                  rows={3}
                  placeholder="Наприклад: Валентина Островська народилась у…"
                  className={cn("resize-none", authorBioMissing && missingRing)}
                />
              </div>

              {newAuthorError && <p className="text-xs text-red-500">{newAuthorError}</p>}
              <Button type="button" variant="outline" size="sm" onClick={addBookAuthor}>+ Додати автора</Button>
            </div>
            </CollapsibleSection>
          </div>

            {/* T-2060 п.5 — окрема сутність, не змішана з авторами */}
            <div className="rounded-lg border p-3">
              <CollapsibleSection title="Над книгою працювали" description="Редактор, ілюстратор, дизайнер обкладинки тощо.">
              <div className="space-y-2">
              {contributors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {contributors.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {c.role}: {c.name}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContributor(i)}
                        className="h-auto w-auto p-0 text-gray-400 hover:bg-transparent hover:text-red-600"
                      >
                        ×
                      </Button>
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
              </CollapsibleSection>
            </div>

          {/* Тільки для книги, яка вже була опублікована десь ще (напр.
              proza.ru/stihi.ru) до приєднання до ULIT -- більшість
              авторів це поле не заповнюють взагалі. Starts collapsed: no
              usage stats yet on how many authors actually have prior-
              publication data to fill in here, so it defaults closed until
              there's data to justify opening it by default. */}
          <div className="rounded-lg border p-3">
            <CollapsibleSection
              title="Авторське право / попередня публікація"
              description="Заповнюйте, лише якщо книга вже виходила раніше на іншій платформі — до приєднання до ULIT."
              defaultOpen={false}
            >
            <div className="space-y-3">
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
                  <Label className="flex items-start gap-2 font-normal text-xs text-gray-500">
                    <Checkbox
                      checked={claimIsbnAttested}
                      onCheckedChange={(v) => setClaimIsbnAttested(v === true)}
                      className="mt-0.5"
                    />
                    Підтверджую, що цей ISBN дійсно раніше офіційно присвоєно саме цій книзі, і я несу
                    відповідальність за коректність цих даних.
                  </Label>
                  {claimIsbnError && <p className="text-xs text-red-500">{claimIsbnError}</p>}
                </>
              )}
            </div>
            </div>
            </CollapsibleSection>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label className="flex items-center gap-2 font-normal text-sm text-gray-700">
              <Controller
                control={infoForm.control}
                name="aiGenerated"
                render={({ field }) => (
                  <Checkbox checked={field.value ?? false} onCheckedChange={(v) => field.onChange(v === true)} />
                )}
              />
              Текст (або обкладинку) частково/повністю створено за допомогою ШІ
            </Label>
            {aiGeneratedValue && (
              <Textarea
                {...infoForm.register("aiGeneratedNote")}
                rows={2}
                placeholder="Уточніть, що саме створено за допомогою ШІ (необов'язково)"
                className="text-xs resize-none"
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setInfoSaved(false)}
                aria-label="Закрити"
                className={cn(
                  "absolute right-2 top-2 h-auto w-auto p-0 leading-none hover:bg-transparent hover:opacity-70",
                  justStagedFields.length > 0 ? "text-amber-500 hover:text-amber-500" : "text-green-500 hover:text-green-500"
                )}
              >
                ×
              </Button>
              {justStagedFields.length > 0 ? (
                <>
                  ✓ Збережено як чернетку
                  <span className="block text-xs text-amber-600 mt-0.5">
                    Книга вже опублікована на сайті — зміни в {justStagedFields.join(", ")} збережено як чернетку. Вони
                    з&apos;являться в магазині після повторної модерації (вкладка «Публікація»). Решта полів (ціна, формати,
                    автори тощо) оновилась одразу.
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

          <SaveActionButton
            type="submit"
            state={infoSaveState}
            idleLabel="Зберегти зміни"
            disabled={infoIncomplete}
            title={infoIncomplete ? "Заповніть усі обов'язкові поля (позначені *, підсвічені помаранчевим)" : undefined}
          />
        </form>
      </Card>
    </div>
  );
}
