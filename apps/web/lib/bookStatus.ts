export const BOOK_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Чернетка", className: "bg-gray-100 text-gray-600" },
  PROCESSING: { label: "Обробка", className: "bg-blue-100 text-blue-700" },
  REVIEW: { label: "На перевірці", className: "bg-yellow-100 text-yellow-700" },
  PUBLISHED: { label: "Опубліковано", className: "bg-green-100 text-green-700" },
  UNPUBLISHED: { label: "Знято з публікації", className: "bg-orange-100 text-orange-700" },
  ARCHIVED: { label: "Архів", className: "bg-gray-100 text-gray-500" },
};

// `status` stays REVIEW for the entire admin-moderation + contract flow (it only
// becomes PUBLISHED once the contract is signed) — so a flat status->label lookup
// keeps showing "На перевірці" even after admin already approved the book and it
// moved on to the contract-signing stage. Layer publicationTimeline on top to
// reflect that.
export function getBookStatusLabel(
  status: string,
  publicationTimeline?: Record<string, string> | null
): { label: string; className: string } {
  if (status === "REVIEW" && publicationTimeline?.review_done) {
    return { label: "Затверджена", className: "bg-teal-100 text-teal-700" };
  }
  return BOOK_STATUS_LABELS[status] ?? BOOK_STATUS_LABELS.DRAFT;
}
