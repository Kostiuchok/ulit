"use client";

import { AuthorBooksSidebar } from "@/components/dashboard/AuthorBooksSidebar";

export default function BooksWithSidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <AuthorBooksSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
