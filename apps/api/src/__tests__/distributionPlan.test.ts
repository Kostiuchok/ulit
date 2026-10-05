import { describe, it, expect } from "vitest";
import { planDistributionChange, deriveStrategy } from "../lib/distributionPlan";
import { AppError } from "../errors/AppError";

// FORMS-REFACTOR-PLAN.md, етап 2: the store-list decision both writers share.

const NOW = new Date("2026-10-05T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const notEnrolled = { kdpSelectEnrolled: false, kdpSelectExpiry: null };
const activeKdp = { kdpSelectEnrolled: true, kdpSelectExpiry: new Date(NOW.getTime() + 30 * DAY) };
const expiredKdp = { kdpSelectEnrolled: true, kdpSelectExpiry: new Date(NOW.getTime() - DAY) };

describe("deriveStrategy", () => {
  it("Amazon KDP alone (with or without ULIT) is KDP Select", () => {
    expect(deriveStrategy(["KDP"])).toBe("KDP_SELECT");
    expect(deriveStrategy(["ULIT", "KDP"])).toBe("KDP_SELECT");
  });
  it("any other store alongside makes it wide", () => {
    expect(deriveStrategy(["ULIT", "KDP", "D2D"])).toBe("WIDE");
    expect(deriveStrategy(["ULIT", "KDP", "GOOGLE"])).toBe("WIDE");
    expect(deriveStrategy(["ULIT"])).toBe("WIDE");
    expect(deriveStrategy([])).toBe("WIDE");
  });
});

describe("planDistributionChange", () => {
  it("wide distribution: not enrolled, expiry cleared, no reminder", () => {
    const plan = planDistributionChange(notEnrolled, ["ULIT", "D2D", "GOOGLE"], NOW);
    expect(plan.data).toEqual({
      distributionChannels: ["ULIT", "D2D", "GOOGLE"],
      distributionStrategy: "WIDE",
      kdpSelectEnrolled: false,
      kdpSelectExpiry: null,
    });
    expect(plan.newKdpSelectExpiry).toBeNull();
  });

  it("switching to KDP only starts a 90-day term and asks for a reminder", () => {
    const plan = planDistributionChange(notEnrolled, ["ULIT", "KDP"], NOW);
    expect(plan.data.distributionStrategy).toBe("KDP_SELECT");
    expect(plan.data.kdpSelectEnrolled).toBe(true);
    expect(plan.data.kdpSelectExpiry).toEqual(new Date(NOW.getTime() + 90 * DAY));
    expect(plan.newKdpSelectExpiry).toEqual(new Date(NOW.getTime() + 90 * DAY));
  });

  it("an expired term counts as not enrolled: KDP only starts a new term", () => {
    const plan = planDistributionChange(expiredKdp, ["KDP"], NOW);
    expect(plan.newKdpSelectExpiry).toEqual(new Date(NOW.getTime() + 90 * DAY));
  });

  it("saving again during an active term leaves its expiry untouched", () => {
    const plan = planDistributionChange(activeKdp, ["ULIT", "KDP"], NOW);
    expect(plan.data.kdpSelectEnrolled).toBe(true);
    expect(plan.data.kdpSelectExpiry).toBeUndefined();
    expect(plan.newKdpSelectExpiry).toBeNull();
  });

  it("adding another store during an active KDP Select term is refused", () => {
    expect(() => planDistributionChange(activeKdp, ["ULIT", "KDP", "D2D"], NOW)).toThrow(AppError);
    try {
      planDistributionChange(activeKdp, ["ULIT", "D2D"], NOW);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("KDP_SELECT_ACTIVE");
      expect((e as AppError).statusCode).toBe(400);
    }
  });

  it("after the term has expired, going wide is allowed", () => {
    const plan = planDistributionChange(expiredKdp, ["ULIT", "KDP", "D2D"], NOW);
    expect(plan.data.distributionStrategy).toBe("WIDE");
    expect(plan.data.kdpSelectExpiry).toBeNull();
  });
});
