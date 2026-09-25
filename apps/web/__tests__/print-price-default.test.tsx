import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { siteRoyaltyRate } from "shared-types";
import { computeAnchorPrices, computeBwPrices, type PrintCost } from "@/components/books/FormatsAndDistribution";
import { BookPurchaseWidget } from "@/components/store/BookPurchaseWidget";

// Live shelf prices of https://ulit.render.ua/books/12345-5678 on 2026-09-25.
// Color softcover is the derived shelf price; B/W softcover is the typed one.
// The storefront must open the print panel on B/W (~200), not color (~640).
const BOOK_12345_5678 = {
  priceEbook: 142.86,
  pricePrint: 640,
  pricePrintHardcover: 782.86,
  pricePrintBw: 200,
  pricePrintHardcoverBw: 342.86,
};

const DONE: PrintCost = { status: "DONE", softcoverCost: 300, hardcoverCost: 400 };

afterEach(() => {
  cleanup();
});

describe("print shelf price (B/W typed, color derived from print-cost)", () => {
  it("keeps a typed B/W price and derives color from production cost divided by the author royalty rate", () => {
    const rate = siteRoyaltyRate();
    const bw = computeBwPrices(DONE, "200");
    const color = computeAnchorPrices(DONE, "100", "80");

    expect(bw.pricePrintBw).toBe(200);
    expect(bw.pricePrintHardcoverBw).toBeCloseTo(200 + (400 - 300) / rate, 2);
    expect(color.priceEbook).toBeCloseTo(100 / rate, 2);
    expect(color.pricePrint).toBeCloseTo((300 + 80) / rate, 2);
    expect(color.pricePrintHardcover).toBeCloseTo((400 + 80) / rate, 2);
    // Color shelf sits well above the 200 UAH B/W price for this cost.
    expect(color.pricePrint!).toBeGreaterThan(400);
    expect(bw.pricePrintBw!).toBeLessThan(color.pricePrint!);
  });

  it("does not invent a B/W price when the author left that field empty", () => {
    expect(computeBwPrices(DONE, "")).toEqual({});
    expect(computeBwPrices({ status: "NO_PAGE_COUNT" }, "200").pricePrintHardcoverBw).toBeUndefined();
    expect(computeAnchorPrices({ status: "NO_SETTINGS" }, "", "50").pricePrint).toBeUndefined();
  });
});

describe("book 12345-5678 default print selection", () => {
  function renderPrint() {
    render(
      <BookPurchaseWidget
        bookId="12345-5678"
        title="Назва том 3"
        author="Автор"
        format="print"
        priceEbook={BOOK_12345_5678.priceEbook}
        pricePrint={BOOK_12345_5678.pricePrint}
        pricePrintHardcover={BOOK_12345_5678.pricePrintHardcover}
        pricePrintBw={BOOK_12345_5678.pricePrintBw}
        pricePrintHardcoverBw={BOOK_12345_5678.pricePrintHardcoverBw}
      />
    );
  }

  it("defaults to softcover black-and-white at about 200 UAH, not the 640 UAH color price", () => {
    renderPrint();
    expect(screen.getByRole("tab", { name: "М'яка" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByRole("tab", { name: "Чорно-білий друк" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByText("200.00 грн")).toBeTruthy();
    expect(screen.queryByText("640.00 грн")).toBeNull();
  });

  it("shows the color price only after the buyer picks color", () => {
    renderPrint();
    // Radix TabsTrigger selects on mouseDown (button 0), not on click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Кольоровий друк" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("640.00 грн")).toBeTruthy();
    expect(screen.queryByText("200.00 грн")).toBeNull();
  });

  it("falls back to whichever single ink the book actually sells", () => {
    const { unmount } = render(
      <BookPurchaseWidget
        bookId="color-only"
        title="Лише колір"
        author="Автор"
        format="print"
        pricePrint={640}
        pricePrintHardcover={782.86}
      />
    );
    expect(screen.getByText("640.00 грн")).toBeTruthy();
    unmount();

    render(
      <BookPurchaseWidget
        bookId="bw-only"
        title="Лише ч/б"
        author="Автор"
        format="print"
        pricePrintBw={200}
        pricePrintHardcoverBw={342.86}
      />
    );
    expect(screen.getByText("200.00 грн")).toBeTruthy();
  });
});
