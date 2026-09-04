"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";

export interface AppNotification {
  id: string;
  type: "BOOK_APPROVED" | "BOOK_REJECTED";
  message: string;
  bookId: string | null;
  book?: { id: string; title: string } | null;
  read: boolean;
  createdAt: string;
}

// Admin actions (approve/reject) happen in a different browser session than
// the author's, so there's no in-tab event to react to -- polling is the only
// way the bell learns about it. Also refreshes on `ulit:books-changed` so
// marking read/resubmitting doesn't wait for the next poll tick. Per-book
// "needs attention" badges (sidebar, book list) are a SEPARATE, live-computed
// flag from GET /api/books (needsAttention) -- not driven by this hook, so
// they never go stale just because a notification was marked read without
// the underlying issue actually being fixed.
const POLL_INTERVAL_MS = 30000;

export function useNotifications() {
  const { apiFetch, token } = useApi();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ notifications: AppNotification[]; unreadCount: number }>("/api/notifications")
      .then(({ notifications, unreadCount }) => {
        setNotifications(notifications);
        setUnreadCount(unreadCount);
      })
      .catch(() => {});
  }, [apiFetch, token]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, load]);

  useEffect(() => {
    window.addEventListener("ulit:books-changed", load);
    return () => window.removeEventListener("ulit:books-changed", load);
  }, [load]);

  const markRead = useCallback(
    async (id: string) => {
      let wasUnread = false;
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          if (!n.read) wasUnread = true;
          return { ...n, read: true };
        })
      );
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      } catch {
        load();
      }
    },
    [apiFetch, load]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
    } catch {
      load();
    }
  }, [apiFetch, load]);

  return { notifications, unreadCount, markRead, markAllRead, refresh: load };
}
