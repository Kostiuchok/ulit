"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
}

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/books", label: "Книги", icon: "📚" },
  { href: "/admin/udk-queue", label: "Реєстрація УДК", icon: "🔖" },
  { href: "/admin/print-orders", label: "Друковані замовлення", icon: "🖨️" },
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
  { href: "/admin/settings/print-cost", label: "Собівартість друку", icon: "💵" },
  { href: "/admin/services", label: "Сервіси", icon: "⚙️" },
];

export function AdminSidebar() {
  const path = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/admin/dashboard" className="flex h-12 items-center gap-2 px-2 font-bold text-sidebar-foreground">
          <span className="shrink-0">🛡</span>
          <span className="truncate group-data-[collapsible=icon]:hidden">ULIT Admin</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                if ("children" in item && item.children) {
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarGroupLabel className="h-auto px-2 py-1.5">
                        {item.icon} {item.label}
                      </SidebarGroupLabel>
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={path === child.href}>
                              <Link href={child.href}>{child.label}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  );
                }

                const active = path === item.href || path?.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href!}>
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="На сайт">
              <Link href="/">
                <span>←</span>
                <span>На сайт</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
