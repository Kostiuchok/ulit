import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { deriveCoverTheme, coverThemeTextContrasts } from "shared-types";

// Reference output of docs/dashboard-ui/cover-styles/derive.py (4 Figma
// modes + 8 stress colours) -- the TS port must match it hex-for-hex.
const reference = JSON.parse(
  readFileSync(join(__dirname, "../../../../docs/dashboard-ui/cover-styles/tokens.json"), "utf8")
) as Record<string, { tokens: Record<string, string>; lightBase: boolean }>;

const TOKEN_KEYS: Record<string, string> = {
  base: "base",
  bg: "bg",
  "bg-alt": "bgAlt",
  surface: "surface",
  accent: "accent",
  "text-primary": "textPrimary",
  "text-secondary": "textSecondary",
  "text-on-accent": "textOnAccent",
  "text-on-surface": "textOnSurface",
  line: "line",
  pattern: "pattern",
};

describe("deriveCoverTheme (auto-cover theme from one author colour)", () => {
  for (const [name, ref] of Object.entries(reference)) {
    it(`matches derive.py for ${name}`, () => {
      const theme = deriveCoverTheme(ref.tokens.base) as unknown as Record<string, unknown>;
      for (const [refKey, key] of Object.entries(TOKEN_KEYS)) {
        // The one deliberate deviation: derive.py's own #8F8F8F for pure
        // black is 4.49:1 against bg-alt once rounded to hex (the reference
        // checks float colours). The port's quantized guard steps it back
        // one notch to a real >= 4.5.
        if (name === "#000000" && refKey === "text-secondary") {
          expect(theme[key]).toBe("#949494");
          continue;
        }
        expect(theme[key], refKey).toBe(ref.tokens[refKey]);
      }
      expect(theme.isLight).toBe(ref.lightBase);
    });
  }

  it("every allowed text/background pair clears WCAG AA across the whole hue wheel", () => {
    const bases: string[] = [];
    for (let h = 0; h < 360; h += 15) {
      for (const [s, l] of [[0.9, 0.5], [0.6, 0.25], [0.4, 0.8], [0.15, 0.5]]) {
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
          const k = (n + h / 30) % 12;
          const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
          return Math.round(v * 255).toString(16).padStart(2, "0");
        };
        bases.push(`#${f(0)}${f(8)}${f(4)}`);
      }
    }
    for (const base of bases) {
      const pairs = coverThemeTextContrasts(deriveCoverTheme(base));
      for (const [pair, ratio] of Object.entries(pairs)) {
        expect(ratio, `${base} ${pair}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("falls back to the default colour for a malformed base", () => {
    expect(deriveCoverTheme("nope").base).toBe("#1F3A5F");
  });
});
