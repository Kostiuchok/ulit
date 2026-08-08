export const BOOK_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Чернетка", className: "bg-gray-100 text-gray-600" },
  PROCESSING: { label: "Обробка", className: "bg-blue-100 text-blue-700" },
  REVIEW: { label: "На перевірці", className: "bg-yellow-100 text-yellow-700" },
  PUBLISHED: { label: "Опубліковано", className: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "Архів", className: "bg-gray-100 text-gray-500" },
};
