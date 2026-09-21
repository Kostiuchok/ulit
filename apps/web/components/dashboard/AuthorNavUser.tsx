"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Same DropdownMenu+Avatar pattern as admin's own NavUser -- minus its
// Sidebar-footer coupling (SidebarMenuButton/useSidebar), since the author
// dashboard is a top-bar shell, not a sidebar one. Folds two things that
// used to live in different places into one header control: the old plain
// "ПРОФІЛЬ" link (still the first item here) and sign-out (previously only
// reachable by opening Профіль and scrolling to SignOutButton on
// settings/page.tsx, which stays there too -- this is a shortcut, not a
// replacement).
export function AuthorNavUser({ user }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs text-black outline-none">
        <Avatar className="h-5 w-5">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback className="text-[9px]">{initials(user.name)}</AvatarFallback>
        </Avatar>
        ПРОФІЛЬ
        <ChevronDown className="h-3 w-3 text-black/60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="truncate text-sm font-semibold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings />
            Профіль
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
          <LogOut />
          Вийти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
