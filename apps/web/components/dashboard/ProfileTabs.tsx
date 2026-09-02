"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";

const TABS = [
  { href: "/dashboard", label: "Кабінет автора" },
  { href: "/dashboard/settings", label: "Профіль" },
  { href: "/dashboard/settings/royalties", label: "Авторські відрахування" },
  { href: "/dashboard/settings/stats", label: "Загальна статистика" },
  { href: "/dashboard/settings/books", label: "Мої книги" },
  { href: "/dashboard/settings/purchases", label: "Мої покупки" },
  { href: "/dashboard/settings/bonuses", label: "Мої бонуси" },
  { href: "/dashboard/settings/contract", label: "Договір на публікацію" },
] as const;

const ACCENT = "#ff5900";

export function ProfileTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 sm:px-6 py-3">
        {TABS.map((tab) => {
          // "/dashboard" and "/dashboard/settings" both need an exact match
          // -- every other tab (incl. every settings sub-page) lives under
          // "/dashboard/settings/...", which is also a prefix match for
          // plain "/dashboard", so a naive startsWith() would highlight
          // "Кабінет автора" as active on every settings page too.
          const active =
            tab.href === "/dashboard" || tab.href === "/dashboard/settings"
              ? pathname === tab.href
              : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "whitespace-nowrap text-xs font-semibold uppercase tracking-wide pb-1 border-b-2 transition-colors",
                active ? "border-current" : "border-transparent text-gray-500 hover:text-gray-800"
              )}
              style={active ? { color: ACCENT } : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
