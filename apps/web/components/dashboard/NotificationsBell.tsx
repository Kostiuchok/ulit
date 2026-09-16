"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const TYPE_ICON: Record<string, string> = {
  BOOK_APPROVED: "✅",
  BOOK_REJECTED: "⚠️",
};

export function NotificationsBell() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="relative flex items-center" aria-label="Сповіщення">
          <img src="/figma/alert.svg" alt="" className="h-[1rem] w-[1rem]" />
          {unreadCount > 0 && (
            <span className="absolute -top-2.5 -right-3.5 rounded-sm bg-[#ff5900] px-1.5 py-0.5 text-[0.75rem] font-black leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 text-left">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <span className="text-sm font-semibold text-gray-900">Сповіщення</span>
          {notifications.length > 0 && (
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <Button variant="link" onClick={markAllRead} className="h-auto p-0 text-xs text-primary">
                  Прочитати всі
                </Button>
              )}
              <Button variant="link" onClick={clearAll} className="h-auto p-0 text-xs text-gray-400 hover:text-gray-600">
                Очистити
              </Button>
            </div>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Немає сповіщень</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={n.bookId ? `/dashboard/books/${n.bookId}` : "/dashboard/books"}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 border-b border-gray-100 px-4 py-3 text-sm last:border-0 hover:bg-gray-50",
                  !n.read && "bg-primary/5"
                )}
              >
                <span className="shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800">{n.message}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-gray-400">
                    {new Date(n.createdAt).toLocaleString("uk-UA")}
                  </p>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff5900]" />}
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
