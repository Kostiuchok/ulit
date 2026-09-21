import Link from "next/link";
import { auth } from "@/auth";
import { AuthorBooksSidebar } from "@/components/dashboard/AuthorBooksSidebar";
import { FontSizeControl } from "@/components/dashboard/FontSizeControl";
import { NotificationsBell } from "@/components/dashboard/NotificationsBell";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Server component (parent dashboard/layout.tsx already gates on
// auth()/redirect -- this just needs the user for the sidebar's own footer)
// so AuthorBooksSidebar/AuthorSidebarNavUser render with the real user on
// first paint, same as admin/layout.tsx does for AdminSidebar -- no
// client-side useSession() loading flash.
export default async function BooksWithSidebarLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <SidebarProvider>
      <AuthorBooksSidebar user={session?.user} />
      <SidebarInset className="min-w-0">
        <header className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-6 w-6" />
            <Separator orientation="vertical" className="h-4" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-gray-500 hover:text-black">
              На сайт
            </Link>
            <FontSizeControl />
            <NotificationsBell />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
