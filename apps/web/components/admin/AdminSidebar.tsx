"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "./NavUser";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/books", label: "Книги", icon: "📚" },
  { href: "/admin/udk-queue", label: "Реєстрація УДК", icon: "🔖" },
  { href: "/admin/print-orders", label: "Друковані замовлення", icon: "🖨️" },
  { href: "/admin/distribution", label: "Дистрибуція", icon: "📦" },
  { href: "/admin/applications", label: "Заявки", icon: "📋" },
  { href: "/admin/royalties", label: "Роялті", icon: "💰" },
  { href: "/admin/authors", label: "Автори", icon: "👤" },
  { href: "/admin/settings/print-cost", label: "Собівартість друку", icon: "💵" },
  { href: "/admin/services", label: "Сервіси", icon: "⚙️" },
];

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
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
                const active = path === item.href || path?.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
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
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
