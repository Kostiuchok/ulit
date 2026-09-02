"use client";

import { useState } from "react";
import { useApi } from "../../hooks/useApi";

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
    <button
      onClick={handleClick}
      disabled={!hasChanges || loading}
      title={hasChanges ? "Надіслати зміни на повторну модерацію" : "Немає нових незбережених змін"}
      className={
        hasChanges
          ? "rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50 disabled:opacity-50"
          : "rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-300 cursor-not-allowed"
      }
    >
      {loading ? "Надсилаємо…" : "Опублікувати із змінами"}
    </button>
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
