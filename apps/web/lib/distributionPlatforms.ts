export interface DistributionPlatform {
  key: "ULIT" | "D2D" | "KDP" | "GOOGLE";
  icon: string;
  name: string;
  royalty: string;
  royaltyMin: number;
  royaltyMax: number;
  description: string;
  locked: boolean;
}

export const DISTRIBUTION_PLATFORMS: DistributionPlatform[] = [
  {
    key: "ULIT",
    icon: "📚",
    name: "Магазин Ulit",
    royalty: "70%",
    royaltyMin: 0.7,
    royaltyMax: 0.7,
    description: "Власний магазин платформи. Завжди увімкнений.",
    locked: true,
  },
  {
    key: "D2D",
    icon: "🌐",
    name: "Draft2Digital",
    royalty: "60%",
    royaltyMin: 0.6,
    royaltyMax: 0.6,
    description: "40+ ритейлерів: Barnes & Noble, Kobo, Apple Books та інші.",
    locked: false,
  },
  {
    key: "KDP",
    icon: "🔶",
    name: "Amazon KDP",
    royalty: "35–70%",
    royaltyMin: 0.35,
    royaltyMax: 0.7,
    description: "Amazon Kindle Store. Якщо обрано без D2D і Google — активується KDP Select (90 днів ексклюзивності).",
    locked: false,
  },
  {
    key: "GOOGLE",
    icon: "🎮",
    name: "Google Play Books",
    royalty: "52%",
    royaltyMin: 0.52,
    royaltyMax: 0.52,
    description: "Google Play Books Store.",
    locked: false,
  },
];
