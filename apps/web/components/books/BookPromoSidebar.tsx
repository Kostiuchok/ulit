"use client";

const PREP_ITEMS = [
  { label: "Про-акаунт", price: "від 2 700 ₴" },
  { label: "Редактура", price: "від 5 200 ₴" },
  { label: "Коректура", price: "від 2 500 ₴" },
  { label: "Проста верстка", price: "від 1 990 ₴" },
  { label: "Дизайн обкладинки", price: "від 4 800 ₴" },
];

const READY_ITEMS = ["Тираж книги", "Аудіокнига"];
const PROMO_ITEMS = ["Офлайн-продаж", "Просування", "Буктрейлер"];

function ComingSoonTag() {
  return (
    <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[0.6875rem] font-medium text-green-700">
      Скоро
    </span>
  );
}

// Not wired to anything yet — every action here is disabled (T-1952). Colors
// intentionally stick to our neutral/green palette, not the orange used in
// the Figma reference (docs/ulit-reference/ is visual inspiration only).
export function BookPromoSidebar() {
  return (
    <div className="space-y-6">
      <h2 className="text-xs font-bold uppercase tracking-wide text-black">Зробіть книгу кращою</h2>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Підготовка книги</p>
        <div className="space-y-1.5">
          {PREP_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled
              title="Скоро буде доступно"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-400 cursor-not-allowed"
            >
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 text-xs">{item.price}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Коли книга готова</p>
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {READY_ITEMS.map((label) => (
            <div key={label} className="flex items-center justify-between py-2 text-sm text-black">
              <span>{label}</span>
              <ComingSoonTag />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Просування книги</p>
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {PROMO_ITEMS.map((label) => (
            <div key={label} className="flex items-center justify-between py-2 text-sm text-black">
              <span>{label}</span>
              <ComingSoonTag />
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-300 cursor-not-allowed select-none">Усі послуги</p>
    </div>
  );
}
