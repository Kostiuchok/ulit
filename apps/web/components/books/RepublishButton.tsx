"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { Button } from "../ui/button";

interface PendingFieldsProps {
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
}

function getPendingFields({ docxUpdatedAt, publishedAt, pendingTitle, pendingDescription, pendingGenre }: PendingFieldsProps) {
  const hasDocxChanges = !!docxUpdatedAt && (!publishedAt || docxUpdatedAt > publishedAt);
  const pendingFields = [
    pendingTitle != null && "назву",
    pendingDescription != null && "анотацію",
    pendingGenre != null && "жанр",
  ].filter(Boolean) as string[];
  return { hasDocxChanges, pendingFields };
}

// BookDashboard's header needs the same "is there anything waiting to be
// resubmitted" fact RepublishButton computes internally, both to decide
// which primary action to show (WF-SPEC "01 Дашборд" п.5: "Надіслати на
// модерацію (N)" replaces "Сайт книги" as primary when there are changes)
// and for the amber banner's block list -- single source of truth instead
// of a second parallel hasChanges calculation drifting from this one.
// "Блок" here, not "поле": title/description/genre all belong to one
// "Вихідні дані" block (matches "07 Огляд"'s own per-block grouping), the
// manuscript docx is its own "Рукопис" block. Cover isn't staged yet
// (Phase 3 generalizes cover-approval) so it can't appear here.
export function getChangesSummary(props: PendingFieldsProps) {
  const { hasDocxChanges, pendingFields } = getPendingFields(props);
  const blocks = [
    pendingFields.length > 0 && "Вихідні дані",
    hasDocxChanges && "Рукопис",
  ].filter(Boolean) as string[];
  return { hasChanges: blocks.length > 0, blocks };
}

// Same "очікує на надсилання" note RepublishButton shows inline below its
// own button -- pulled out so a caller that puts the button in a shared row
// with other buttons (BookDashboard's header) can render this note on its
// own full-width line instead, without a taller flex item shifting the
// button's apparent vertical position against its row siblings.
export function RepublishPendingNote(props: PendingFieldsProps) {
  const { hasDocxChanges, pendingFields } = getPendingFields(props);
  if (pendingFields.length === 0) return null;
  return (
    <p className="text-xs text-gray-400">
      Ще не на сайті — очікує на надсилання: {pendingFields.join(", ")}
      {hasDocxChanges && (pendingFields.length > 0 ? ", рукопис" : "рукопис")}.
    </p>
  );
}

interface Props extends PendingFieldsProps {
  bookId: string;
  republishRequestedAt?: string | null;
  onSubmitted?: (republishRequestedAt: string) => void;
  // BookDashboard's header renders several buttons in one row -- the note
  // below would make this button's flex item taller than its siblings,
  // shifting it up relative to them under `items-center`. Set false there
  // and render <RepublishPendingNote> separately below the whole row.
  showNote?: boolean;
}

export function RepublishButton({
  bookId,
  docxUpdatedAt,
  publishedAt,
  republishRequestedAt,
  pendingTitle,
  pendingDescription,
  pendingGenre,
  onSubmitted,
  showNote = true,
}: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDocxChanges = !!docxUpdatedAt && (!publishedAt || docxUpdatedAt > publishedAt);
  const pendingFields = [
    pendingTitle != null && "назву",
    pendingDescription != null && "анотацію",
    pendingGenre != null && "жанр",
  ].filter(Boolean) as string[];
  const hasChanges = hasDocxChanges || pendingFields.length > 0;
  // republishRequestedAt is always cleared by the admin's approve/reject
  // (admin.ts) -- its mere presence means a request is already in flight.
  const isPending = !!republishRequestedAt;

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const { book } = await apiFetch<{ book: { republishRequestedAt: string } }>(
        `/api/books/${bookId}/republish`,
        { method: "POST", body: JSON.stringify({}) }
      );
      onSubmitted?.(book.republishRequestedAt);
    } catch (e: any) {
      setError(e.message || "Помилка надсилання змін");
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
        ⏳ Зміни на модерації
        {pendingFields.length > 0 && (
          <span className="block text-xs text-amber-600 mt-0.5">
            Очікують: {pendingFields.join(", ")}{hasDocxChanges && (pendingFields.length > 0 ? ", рукопис" : "рукопис")}
          </span>
        )}
      </div>
    );
  }

  const button = (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={!hasChanges}
      loading={loading}
      title={hasChanges ? "Надіслати зміни на повторну модерацію" : "Немає нових незбережених змін"}
      className={
        hasChanges
          ? "border-black text-black hover:bg-gray-50 hover:text-black"
          : "cursor-not-allowed border-gray-300 text-gray-300"
      }
    >
      Опублікувати із змінами
    </Button>
  );

  if (!showNote) {
    return (
      <div className="flex items-center gap-2">
        {button}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {button}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <RepublishPendingNote
        docxUpdatedAt={docxUpdatedAt}
        publishedAt={publishedAt}
        pendingTitle={pendingTitle}
        pendingDescription={pendingDescription}
        pendingGenre={pendingGenre}
      />
    </div>
  );
}

// WF-SPEC "01 Дашборд" п.5: when there are changes, the dashboard header's
// primary action becomes "Надіслати на модерацію (N)" (not the plain
// outline "Опублікувати із змінами" RepublishButton renders everywhere
// else) -- a separate component rather than a style prop on RepublishButton
// itself, since that one is already used as-is on 4 other pages (output-data,
// manuscript, BookDistribution, output-data/publish) this session isn't
// touching. Renders nothing when republishRequestedAt is set (BookDashboard
// shows RepublishPendingNote's "⏳ На модерації" state instead) or when
// there's nothing to send.
export function RepublishPrimaryButton({
  bookId,
  republishRequestedAt,
  onSubmitted,
  ...pendingProps
}: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hasChanges, blocks } = getChangesSummary(pendingProps);
  const isPending = !!republishRequestedAt;

  if (isPending || !hasChanges) return null;

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const { book } = await apiFetch<{ book: { republishRequestedAt: string } }>(
        `/api/books/${bookId}/republish`,
        { method: "POST", body: JSON.stringify({}) }
      );
      onSubmitted?.(book.republishRequestedAt);
    } catch (e: any) {
      setError(e.message || "Помилка надсилання змін");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleClick} loading={loading} title="Надіслати зміни на повторну модерацію" className="gap-1.5">
        <Send size={14} />
        Надіслати на модерацію
        <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-xs">{blocks.length}</span>
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
