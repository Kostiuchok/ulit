"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthorNavUser } from "./AuthorNavUser";
import { FontSizeControl } from "./FontSizeControl";
import { NotificationsBell } from "./NotificationsBell";

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

// The book area (dashboard/books/(withSidebar)/layout.tsx) has its own
// shadcn Sidebar now, with its own top bar (SidebarTrigger + FontSizeControl
// + NotificationsBell) and "На сайт"/profile moved into the sidebar's own
// footer (AuthorSidebarNavUser) -- shadcn's Sidebar positions itself `fixed
// inset-y-0` from the actual top of the viewport (see sidebar.tsx), so
// rendering this global header ABOVE it here too would visually collide
// with it rather than sit above it. Every other dashboard page (Налаштування
// etc., no Sidebar) keeps this header exactly as before.
export function DashboardHeader({ user }: Props) {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard/books")) return null;

  return (
    <header className="shrink-0 bg-[#d9d9d9]">
      <div className="h-8 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/books" className="flex items-center gap-1">
            <img src="/figma/logo-group.svg" alt="" className="h-[1.125rem] w-[1.125rem]" />
            <span className="text-xs font-black tracking-tight text-black">ULIT</span>
          </Link>
          <Link href="/" className="text-xs text-black/70 hover:text-black">
            На сайт
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <FontSizeControl />
          <NotificationsBell />
          <AuthorNavUser user={user} />
        </div>
      </div>
    </header>
  );
}
