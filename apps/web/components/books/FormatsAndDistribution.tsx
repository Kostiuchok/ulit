"use client";

import Link from "next/link";
import { priceInputSchema } from "shared-types";
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

// pricePrintBw is the only price field still typed directly (everything
// else is derived -- from a royalty input via computeAnchorPrices, or from
// it via computeBwPrices) -- shared priceInputSchema (shared-types) is
// the same shape apps/api's book.ts/books.ts validate the saved value
// against, minus the DB-facing `.nullable()` a raw controlled <input>
// doesn't need (its own empty-string state covers "not set").
function parsePrice(v: string): number | undefined {
  const result = priceInputSchema.safeParse(v);
  return result.success && result.data !== "" ? result.data : undefined;
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

// Black-and-white prices. The author types ONE number -- the buyer price of
// the softcover B&W copy -- and the hardcover B&W price is derived from it,
// instead of two unrelated numbers nothing kept consistent with each other.
// The delta is the REAL binding-cost difference from print-cost (a hardcover
// costs more to bind than a softcover), grossed up by Ulit's rate so the
// author's own per-copy earnings come out the same on both bindings --
// exactly the relationship computeAnchorPrices() produces for colour print.
// There is no B&W-specific production cost in print-cost.ts, which is why
// this one stays a direct price and not a royalty calculator.
export function computeBwPrices(
  printCost: PrintCost,
  pricePrintBwInput: string
): { pricePrintBw?: number; pricePrintHardcoverBw?: number } {
  const soft = parsePrice(pricePrintBwInput);
  const cost = printCost?.status === "DONE" ? printCost : null;
  if (soft === undefined) return {};
  return {
    pricePrintBw: soft,
    pricePrintHardcoverBw: cost ? round2(soft + (cost.hardcoverCost - cost.softcoverCost) / ULIT_RATE) : undefined,
  };
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

// The two numbers the author actually cares about -- deliberately loud
// (big, coloured, boxed), since everything else in these blocks is just the
// arithmetic that leads to them.
function PriceTiles({
  caption,
  items,
}: {
  caption: string;
  items: { label: string; value?: number }[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-600">{caption}</p>
      <div className={cn("grid gap-2", items.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-2 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{it.label}</p>
            <p className="text-xl font-extrabold leading-tight text-primary">
              {it.value !== undefined ? `${it.value.toFixed(2)} грн` : "—"}
            </p>
          </div>
        ))}
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
  pricePrintBw,
  onPricePrintBwChange,
  hasManuscript,
  bookId,
  onUploadManuscript,
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
  // Optional B&W alternative price -- ONE direct number (the softcover
  // buyer price); the hardcover B&W price is derived from it by
  // computeBwPrices, not typed. No royalty calculator here: there is no
  // per-B&W production cost in print-cost.ts to build one against. Merged
  // into this same "Продаж друкованої книги" card (T-2075 follow-up)
  // instead of its own separate card+save action -- black-and-white is a
  // print OPTION, not an unrelated concern.
  pricePrintBw: string;
  onPricePrintBwChange: (v: string) => void;
  // Whether a manuscript (.docx) has been uploaded at all -- distinguishes
  // "nothing uploaded yet" from "uploaded, but the print PDF (and so the
  // page count print-cost needs) hasn't been generated yet", which used to
  // show the exact same generic "завантажте рукопис" message even when a
  // manuscript very much had been uploaded.
  hasManuscript: boolean;
  bookId: string;
  // Caller-specific "go fix it" action for the "nothing uploaded" case --
  // BookWizard jumps back to its own "Файл" step, output-data scrolls to
  // its "Рукопис" section; neither is something this shared component can
  // know how to do on its own.
  onUploadManuscript?: () => void;
}) {
  const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");
  const kdpEbookUnsupported = !!language && KDP_EBOOK_UNSUPPORTED_LANGUAGES.includes(language);
  const cost = printCost?.status === "DONE" ? printCost : null;
  const royaltyPrintNum = parseRoyalty(royaltyPrint);
  const royaltyEbookNum = parseRoyalty(royaltyEbook);
  const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
  const bw = computeBwPrices(printCost, pricePrintBw);

  return (
    <div className="space-y-6">
      {/* ── Друкована книга ─────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Продаж друкованої книги</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Формат {formatLabel}
            {pageCount ? ` · ${pageCount} стор.` : ""} · м&apos;яка або тверда обкладинка, кольоровий друк
          </p>
        </div>

        {!cost ? (
          <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            {printCost?.status === "NO_SETTINGS" ? (
              <p>Собівартість друку ще не налаштована адміном.</p>
            ) : hasManuscript ? (
              <>
                <p>Рукопис завантажено, але кількість друкованих сторінок ще не визначена.</p>
                <Link
                  href={`/dashboard/books/${bookId}/manuscript/preview`}
                  className="block text-primary underline hover:no-underline"
                >
                  Відкрити «Передперегляд книги» (згенерує його) →
                </Link>
              </>
            ) : (
              <>
                <p>Завантажте рукопис (.docx), щоб побачити собівартість виготовлення й порахувати ціну.</p>
                {onUploadManuscript && (
                  <button type="button" onClick={onUploadManuscript} className="text-primary underline hover:no-underline">
                    Перейти до розділу «Рукопис» →
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Own outlined block, symmetric with "Чорно-білий друк" below:
                one input each, two loud prices each. The author never types a
                per-binding price for colour -- softcover/hardcover differ only
                by their production cost, so both follow from this one number. */}
            <div className="rounded-lg border p-3 space-y-3">
              <RoyaltyInput
                id="royaltyPrint"
                label="Ваш бажаний гонорар за примірник"
                hint="Скільки хочете отримувати з продажу однієї друкованої книги — понад собівартість виготовлення. Ціну для м'якої і твердої обкладинки порахуємо самі."
                value={royaltyPrint}
                onChange={onRoyaltyPrintChange}
              />
              {royaltyPrintNum !== undefined && (
                <>
                  <PriceTiles
                    caption="Ціна для покупця в магазині Ulit (комісія 30%) — саме ці ціни й буде збережено:"
                    items={[
                      { label: "М'яка обкладинка", value: anchor.pricePrint },
                      { label: "Тверда обкладинка", value: anchor.pricePrintHardcover },
                    ]}
                  />
                  <p className="text-xs text-gray-500">
                    Собівартість виготовлення (1 шт): <strong>{cost.softcoverCost.toFixed(2)} грн</strong> (м&apos;яка) /{" "}
                    <strong>{cost.hardcoverCost.toFixed(2)} грн</strong> (тверда) + Ваш гонорар{" "}
                    <strong>{royaltyPrintNum.toFixed(2)} грн</strong> + відсоток платформи = ціна для покупця. Ваш
                    гонорар однаковий для обох обкладинок.
                  </p>
                </>
              )}
            </div>

            {/* T-2075 follow-up -- used to be its own separate card lower on
                the page, with its own "Зберегти ч/б ціни" save button.
                Black-and-white is a print OPTION, not an unrelated concern,
                so it lives inside "Продаж друкованої книги" now, saved
                together with everything else in this section. */}
            <div className="rounded-lg border border-dashed p-3 space-y-3">
              <div className="space-y-1">
                <label htmlFor="pricePrintBw" className="block text-sm font-medium text-gray-800">
                  Чорно-білий друк (опційно)
                </label>
                <p className="text-xs text-gray-500">
                  Дешевше в типографії — запропонуйте покупцю дешевший варіант поруч із кольоровим. Тут вказується пряма
                  ціна для покупця за м&apos;яку обкладинку; ціну твердої порахуємо самі.
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    id="pricePrintBw"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePrintBw}
                    onChange={(e) => onPricePrintBwChange(e.target.value)}
                    placeholder="149.99"
                    className="h-9 w-32 rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="text-sm text-gray-500">грн / примірник (м&apos;яка)</span>
                </div>
              </div>
              {bw.pricePrintBw !== undefined && (
                <>
                  <PriceTiles
                    caption="Ціна для покупця, чорно-білий друк:"
                    items={[
                      { label: "М'яка обкладинка", value: bw.pricePrintBw },
                      { label: "Тверда обкладинка", value: bw.pricePrintHardcoverBw },
                    ]}
                  />
                  <p className="text-xs text-gray-500">
                    Тверда обкладинка дорожча рівно на різницю в собівартості палітурки (
                    {(cost.hardcoverCost - cost.softcoverCost).toFixed(2)} грн + відсоток платформи), тож Ваш гонорар з
                    обох варіантів однаковий.
                  </p>
                </>
              )}
            </div>

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
          <h3 className="text-base font-bold text-gray-900">Продаж електронної книги</h3>
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
          <div className="space-y-1.5">
            <PriceTiles
              caption="Ціна для покупця в магазині Ulit (комісія 30%) — саме ця ціна й буде збережена:"
              items={[{ label: "Електронна книга", value: anchor.priceEbook }]}
            />
            <p className="text-xs text-gray-500">
              На інших каналах кінцева ціна відрізняється через їхню власну комісію (орієнтовно нижче).
            </p>
          </div>
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
