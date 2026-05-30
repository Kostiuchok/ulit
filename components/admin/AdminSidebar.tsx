"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Megaphone,
  Globe,
  Settings,
  Truck,
  BarChart3,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { label: "Головна", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Замовлення", href: "/admin/orders", icon: ShoppingCart },
  { label: "Відвантаження", href: "/admin/shipments", icon: Truck },
  {
    label: "Товари",
    href: "/admin/products",
    icon: Package,
    children: [
      { label: "Всі товари", href: "/admin/products" },
      { label: "Категорії", href: "/admin/products/categories" },
      { label: "Характеристики", href: "/admin/products/features" },
      { label: "Фільтри", href: "/admin/products/filters" },
      { label: "Відгуки", href: "/admin/products/reviews" },
    ],
  },
  { label: "Клієнти", href: "/admin/customers", icon: Users },
  { label: "Звіти", href: "/admin/reports", icon: BarChart3 },
  { label: "Маркетинг", href: "/admin/marketing", icon: Megaphone },
  { label: "Веб-сайт", href: "/admin/website", icon: Globe },
  { label: "Налаштування", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-bold tracking-tight">Ulit</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
            const hasChildren = !!item.children;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {hasChildren && <ChevronRight className="h-3 w-3 opacity-50" />}
                </Link>

                {hasChildren && isActive && (
                  <ul className="mt-0.5 space-y-0.5 pl-10">
                    {item.children!.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={cn(
                            "block rounded-md px-3 py-1.5 text-xs transition-colors",
                            pathname === child.href
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
