"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
}

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/books", label: "Книги", icon: "📚" },
  {
    label: "Дистрибуція",
    icon: "📦",
    children: [
      { href: "/admin/distribution/queue", label: "Черга" },
      { href: "/admin/distribution/bulk", label: "Масова" },
    ],
  },
  {
    label: "Заявки",
    icon: "📋",
    children: [
      { href: "/admin/applications/kdp-api", label: "KDP API" },
      { href: "/admin/applications/google-books", label: "Google Books" },
      { href: "/admin/applications/d2d-partner", label: "D2D Partner" },
    ],
  },
  { href: "/admin/royalties", label: "Роялті", icon: "💰" },
  { href: "/admin/authors", label: "Автори", icon: "👤" },
  { href: "/admin/services", label: "Сервіси", icon: "⚙️" },
];

export function AdminSidebar() {
  const path = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-gray-950 text-gray-300 min-h-screen">
      <div className="px-4 py-5 border-b border-gray-800">
        <Link href="/admin/dashboard" className="text-white font-bold text-base">
          🛡 Knyha Admin
        </Link>
      </div>

      <nav className="py-4 space-y-0.5 px-2">
        {NAV.map((item) => {
          if ("children" in item) {
            return (
              <div key={item.label} className="pt-3">
                <p className="px-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  {item.icon} {item.label}
                </p>
                {(item.children ?? []).map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${
                      path === child.href
                        ? "bg-gray-800 text-white"
                        : "hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                path === item.href || path.startsWith(item.href + "/")
                  ? "bg-gray-800 text-white"
                  : "hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 px-4 w-56">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← На сайт
        </Link>
      </div>
    </aside>
  );
}
