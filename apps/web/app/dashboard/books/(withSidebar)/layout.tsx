"use client";

import { AuthorBooksSidebar } from "@/components/dashboard/AuthorBooksSidebar";

export default function BooksWithSidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <AuthorBooksSidebar />
      <div className="flex-1 min-w-0 h-full overflow-y-auto">{children}</div>
    </div>
  );
}
