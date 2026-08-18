"use client";

import { cn } from "@/lib/utils";
import { DISTRIBUTION_PLATFORMS, KDP_EBOOK_UNSUPPORTED_LANGUAGES } from "@/lib/distributionPlatforms";

// T-2075 -- merges the old separate "Ціна" (raw price inputs) and
// "Розповсюдження" (channel checkboxes) steps into one, matching Ridero's
// "Опубликовать в магазинах" page (docs/ridero-research-preview-cover.md
// section 8, live-reverified https://ridero.ru/my/book/publish/instore/...):
// two blocks, "Продаж друкованої книги" / "Продаж електронної книги", each
// with its own platform checkboxes AND its own royalty input. Reasoning
// behind the two royalty numbers instead of one: print has a real per-unit
// production cost (from print-cost), ebook doesn't, so they can't share one
// number without the print price silently absorbing the ebook's assumptions.
//
// Author-facing model: the author types what THEY want to earn per copy
// ("бажаний гонорар"), not a final shelf price -- the block explains how the
// shelf price actually forms (production cost, for print + that royalty,
// divided by a channel's commission rate) instead of asking the author to
// reverse-engineer it themselves.
//
// Every channel's suggested price is ADVISORY except Ulit (our own store,
// fixed 70% rate, always enabled) -- computeAnchorPrices() below derives the
// one concrete price actually SAVED to priceEbook/pricePrint/
// pricePrintHardcover from Ulit's rate, since apps/api/.../orders.ts requires
// a real stored price to check out (desiredRoyaltyAmount alone was already a
// known simplification for pre-publish validation only, see publish.ts, but
// was never sufficient for an actual purchase). Both call sites (BookWizard
// step 2, output-data's merged Ціна+Розповсюдження section) call this same
// helper when saving so the formula can't drift between the two places.

export type PrintCost =
  | { status: "DONE"; softcoverCost: number; hardcoverCost: number }
  | { status: "NO_PAGE_COUNT" }
  | { status: "NO_SETTINGS" }
  | null;

const ULIT_RATE = 0.7; // DISTRIBUTION_PLATFORMS "ULIT" -- fixed, not a range, so it's the only channel we can derive a single concrete price from.

function parseRoyalty(v: string): number | undefined {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}

// Shared by both BookWizard (on step submit) and output-data (on save) --
// the one concrete price that actually gets written to priceEbook/pricePrint/
// pricePrintHardcover, derived from Ulit's fixed rate. Returns undefined for
// a field when there isn't enough info yet (no royalty entered, or -- for
// print -- no production cost available yet).
export function computeAnchorPrices(
  printCost: PrintCost,
  royaltyEbookInput: string,
  royaltyPrintInput: string
): { priceEbook?: number; pricePrint?: number; pricePrintHardcover?: number } {
  const royaltyEbook = parseRoyalty(royaltyEbookInput);
  const royaltyPrint = parseRoyalty(royaltyPrintInput);
  const cost = printCost?.status === "DONE" ? printCost : null;

  return {
    priceEbook: royaltyEbook !== undefined ? round2(royaltyEbook / ULIT_RATE) : undefined,
    pricePrint:
      royaltyPrint !== undefined && cost ? round2((cost.softcoverCost + royaltyPrint) / ULIT_RATE) : undefined,
    pricePrintHardcover:
      royaltyPrint !== undefined && cost ? round2((cost.hardcoverCost + royaltyPrint) / ULIT_RATE) : undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatUah(n: number): string {
  return `${n.toFixed(2)} грн`;
}

// min price at the channel's best rate (royaltyMax) .. max price at its
// worst rate (royaltyMin) -- fixed-rate channels (Ulit, D2D, Google) collapse
// to a single number since min===max there.
function suggestedPriceRange(cost: number, royalty: number, royaltyMin: number, royaltyMax: number) {
  return { min: (cost + royalty) / royaltyMax, max: (cost + royalty) / royaltyMin };
}

const PRINT_CAPABLE_CHANNELS = new Set(["ULIT", "KDP"]); // only these two are documented (docs/kdp-publishing-guide.md) as doing physical/POD distribution -- D2D and Google are ebook-only retailers per their own DISTRIBUTION_PLATFORMS descriptions.

function RoyaltyInput({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <p className="text-xs text-gray-500">{hint}</p>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="напр. 50"
          className="h-9 w-32 rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-sm text-gray-500">грн / примірник</span>
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  selected,
  onToggle,
  disabled,
  priceLines,
  warning,
}: {
  platform: (typeof DISTRIBUTION_PLATFORMS)[number];
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  priceLines: { label: string; range: { min: number; max: number } | null }[];
  warning?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "rounded-xl border-2 p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300",
        (platform.locked || disabled) && "cursor-default opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{platform.icon}</span>
          <span className="font-semibold text-sm">{platform.name}</span>
        </div>
        <div
          className={cn(
            "w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center",
            selected ? "border-primary bg-primary" : "border-gray-300"
          )}
        >
          {selected && <span className="text-white text-[10px] leading-none">✓</span>}
        </div>
      </div>
      {selected &&
        priceLines.map((line) => (
          <p key={line.label} className="mt-1 text-xs font-medium text-primary">
            {line.label}:{" "}
            {line.range
              ? line.range.min === line.range.max
                ? formatUah(line.range.min)
                : `${formatUah(line.range.min)} – ${formatUah(line.range.max)}`
              : "—"}
          </p>
        ))}
      {platform.locked && <p className="mt-1 text-xs text-gray-400">Не можна вимкнути</p>}
      {warning && <p className="mt-1 text-xs font-medium text-amber-600">{warning}</p>}
    </button>
  );
}

export function FormatsAndDistribution({
  language,
  formatLabel,
  pageCount,
  printCost,
  channels,
  onToggleChannel,
  royaltyEbook,
  onRoyaltyEbookChange,
  royaltyPrint,
  onRoyaltyPrintChange,
}: {
  language?: string;
  formatLabel: string;
  pageCount?: number | null;
  printCost: PrintCost;
  channels: string[];
  onToggleChannel: (key: string) => void;
  royaltyEbook: string;
  onRoyaltyEbookChange: (v: string) => void;
  royaltyPrint: string;
  onRoyaltyPrintChange: (v: string) => void;
}) {
  const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");
  const kdpEbookUnsupported = !!language && KDP_EBOOK_UNSUPPORTED_LANGUAGES.includes(language);
  const cost = printCost?.status === "DONE" ? printCost : null;
  const royaltyPrintNum = parseRoyalty(royaltyPrint);
  const royaltyEbookNum = parseRoyalty(royaltyEbook);
  const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);

  return (
    <div className="space-y-6">
      {/* ── Друкована книга ─────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Продаж друкованої книги</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Формат {formatLabel}
            {pageCount ? ` · ${pageCount} стор.` : ""} · м&apos;яка або тверда обкладинка, кольоровий друк
          </p>
        </div>

        {!cost ? (
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            {printCost?.status === "NO_SETTINGS"
              ? "Собівартість друку ще не налаштована адміном."
              : "Завантажте рукопис, щоб побачити собівартість виготовлення й порахувати ціну."}
          </p>
        ) : (
          <>
            <RoyaltyInput
              id="royaltyPrint"
              label="Ваш бажаний гонорар за примірник"
              hint="Скільки хочете отримувати з продажу однієї друкованої книги — понад собівартість виготовлення."
              value={royaltyPrint}
              onChange={onRoyaltyPrintChange}
            />
            {royaltyPrintNum !== undefined && (
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p>
                  Собівартість виготовлення (1 шт, м&apos;яка): <strong>{cost.softcoverCost.toFixed(2)} грн</strong>
                  {" "}+ Ваш гонорар <strong>{royaltyPrintNum.toFixed(2)} грн</strong> + відсоток платформи = ціна для покупця.
                </p>
                {anchor.pricePrint !== undefined && (
                  <p>
                    У нашому магазині Ulit (комісія 30%) ціна для покупця вийде{" "}
                    <strong className="text-gray-900">{anchor.pricePrint.toFixed(2)} грн</strong> (м&apos;яка),{" "}
                    <strong className="text-gray-900">{anchor.pricePrintHardcover?.toFixed(2)} грн</strong> (тверда) —
                    саме ця ціна й буде збережена.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DISTRIBUTION_PLATFORMS.filter((p) => PRINT_CAPABLE_CHANNELS.has(p.key)).map((p) => {
                const selected = channels.includes(p.key);
                const range =
                  royaltyPrintNum !== undefined
                    ? suggestedPriceRange(cost.softcoverCost, royaltyPrintNum, p.royaltyMin, p.royaltyMax)
                    : null;
                return (
                  <PlatformCard
                    key={p.key}
                    platform={p}
                    selected={selected}
                    onToggle={() => onToggleChannel(p.key)}
                    priceLines={[{ label: "Ціна, м'яка", range }]}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Електронна книга ────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Продаж електронної книги</h3>
          <p className="mt-0.5 text-xs text-gray-500">EPUB, FB2, MOBI — для читалок і смартфонів</p>
        </div>

        <RoyaltyInput
          id="royaltyEbook"
          label="Ваш бажаний гонорар за примірник"
          hint="Скільки хочете отримувати з продажу однієї е-книги — у е-книги немає собівартості виготовлення."
          value={royaltyEbook}
          onChange={onRoyaltyEbookChange}
        />
        {royaltyEbookNum !== undefined && anchor.priceEbook !== undefined && (
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            У нашому магазині Ulit (комісія 30%) ціна для покупця вийде{" "}
            <strong className="text-gray-900">{anchor.priceEbook.toFixed(2)} грн</strong> — саме ця ціна й буде
            збережена. На інших каналах кінцева ціна відрізняється через їхню власну комісію (орієнтовно нижче).
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DISTRIBUTION_PLATFORMS.map((p) => {
            const selected = channels.includes(p.key);
            const range =
              royaltyEbookNum !== undefined ? suggestedPriceRange(0, royaltyEbookNum, p.royaltyMin, p.royaltyMax) : null;
            return (
              <PlatformCard
                key={p.key}
                platform={p}
                selected={selected}
                onToggle={() => onToggleChannel(p.key)}
                priceLines={[{ label: "Ціна", range }]}
                warning={p.key === "KDP" && kdpEbookUnsupported ? "Amazon KDP для цієї мови приймає лише друковані видання — електронна книга на Kindle видана не буде." : undefined}
              />
            );
          })}
        </div>

        {isKdpSelect && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <span className="font-medium">KDP Select (Kindle Unlimited)</span> — ексклюзивна угода з Amazon на 90 днів.
            Протягом цього часу книга не може продаватись на D2D та Google Play Books.
          </div>
        )}
      </div>
    </div>
  );
}
