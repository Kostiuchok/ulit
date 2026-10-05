import { AppError } from "../errors/AppError";

// Pure decision logic for a change of a book's store list -- no database,
// no queue, so it can be unit-tested and shared by both routes that write
// the store list (modules/books/distribution.ts and modules/books/book.ts).

const KDP_SELECT_DAYS = 90;

export function deriveStrategy(channels: string[]): "WIDE" | "KDP_SELECT" {
  const hasKdp = channels.includes("KDP");
  const hasD2d = channels.includes("D2D");
  const hasGoogle = channels.includes("GOOGLE");
  return hasKdp && !hasD2d && !hasGoogle ? "KDP_SELECT" : "WIDE";
}

// Everything a change of the store list implies, decided in ONE place and
// with no side effects: the strategy, the KDP Select enrolment fields, and
// whether the change is allowed at all. Both writers use it -- this file's
// own PATCH and book.ts's PATCH, which is what "Ціна та розповсюдження" now
// calls so that prices, discount and stores are saved by a single update
// (FORMS-REFACTOR-PLAN.md, етап 2). Before that the page sent two requests
// and the second could fail after the first had already been applied.
export function planDistributionChange(
  existing: { kdpSelectEnrolled: boolean; kdpSelectExpiry: Date | null },
  distributionChannels: string[],
  now: Date = new Date()
) {
  const kdpActive = !!(existing.kdpSelectEnrolled && existing.kdpSelectExpiry && existing.kdpSelectExpiry > now);
  const distributionStrategy = deriveStrategy(distributionChannels);

  if (kdpActive && distributionStrategy === "WIDE") {
    throw new AppError(
      `Поки діє KDP Select (до ${existing.kdpSelectExpiry!.toLocaleDateString("uk-UA")}), книгу не можна розміщувати в інших магазинах`,
      400,
      "KDP_SELECT_ACTIVE"
    );
  }

  const isEnrollingKdp = distributionStrategy === "KDP_SELECT" && !kdpActive;
  const expiry = isEnrollingKdp ? new Date(now.getTime() + KDP_SELECT_DAYS * 24 * 60 * 60 * 1000) : null;

  return {
    data: {
      distributionChannels,
      distributionStrategy,
      kdpSelectEnrolled: distributionStrategy === "KDP_SELECT",
      // New enrolment -> new expiry; back to WIDE -> cleared; an enrolment
      // that simply continues -> left untouched (undefined).
      kdpSelectExpiry: isEnrollingKdp ? expiry : distributionStrategy === "WIDE" ? null : undefined,
    },
    // Set only when this change starts a new KDP Select term -- the caller
    // schedules the "term is ending" reminder for this date after saving.
    newKdpSelectExpiry: expiry,
  };
}
