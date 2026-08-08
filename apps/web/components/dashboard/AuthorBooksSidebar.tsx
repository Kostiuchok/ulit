"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Package,
  MessageSquare,
  Download,
  ImagePlus,
  Eye,
  BarChart3,
  Users,
  Percent,
  ChevronDown,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { BOOK_STATUS_LABELS } from "@/lib/bookStatus";
import { cn } from "@/lib/utils";

interface SidebarBook {
  id: string;
  title: string;
  coverUrl?: string | null;
  status: string;
}

type SubNavItem =
  | { label: string; href: (bookId: string) => string; icon?: React.ReactNode; disabled?: false }
  | { label: string; icon?: React.ReactNode; disabled: true };

const TOP_ITEMS: SubNavItem[] = [
  { label: "Замовити тираж", icon: <Package size={14} />, disabled: true },
  { label: "Обговорення книги", icon: <MessageSquare size={14} />, disabled: true },
  {
    label: "Завантажити файли",
    icon: <Download size={14} />,
    href: (id) => `/dashboard/books/${id}/published`,
  },
];

const EDIT_GROUP: SubNavItem[] = [
  {
    label: "Рукопис",
    icon: <img src="/figma/icon-text-edit.svg" alt="" className="h-3.5 w-3.5" />,
    href: (id) => `/dashboard/books/${id}/manuscript`,
  },
  { label: "Обкладинка", icon: <ImagePlus size={14} />, href: (id) => `/dashboard/books/${id}/cover` },
  { label: "Передперегляд", icon: <Eye size={14} />, href: (id) => `/dashboard/books/${id}/preview` },
];

const STORE_GROUP: SubNavItem[] = [
  { label: "Вихідні дані", icon: <Package size={14} />, href: (id) => `/dashboard/books/${id}/output-data` },
  {
    label: "Публікація у магазинах",
    icon: <img src="/figma/icon-publication.svg" alt="" className="h-3.5 w-3.5" />,
    href: (id) => `/dashboard/books/${id}/publish`,
  },
  { label: "Статистика", icon: <BarChart3 size={14} />, disabled: true },
  { label: "Знайти нових читачів", icon: <Users size={14} />, disabled: true },
  { label: "Включити акцію на книгу", icon: <Percent size={14} />, disabled: true },
];

function NavRow({ item, bookId, pathname }: { item: SubNavItem; bookId: string; pathname: string }) {
  const iconEl = item.icon ? <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-gray-500">{item.icon}</span> : null;

  if (item.disabled) {
    return (
      <div
        title="Функція в розробці"
        className="flex h-[29px] items-center gap-2.5 px-4 text-[11px] text-gray-300 cursor-not-allowed"
      >
        {iconEl}
        <span className="flex-1">{item.label}</span>
        <span className="rounded-sm bg-gray-200/60 px-1 py-px text-[9px] text-gray-400">скоро</span>
      </div>
    );
  }
  const href = item.href(bookId);
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex h-[29px] items-center gap-2.5 px-4 text-[11px] font-medium transition-colors",
        active ? "bg-[#e3e3e3] text-black" : "text-black hover:bg-[#e9e9e9]"
      )}
    >
      {iconEl}
      {item.label}
    </Link>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="flex h-[29px] items-center gap-1 px-2 text-[11px] text-black">
      <ChevronDown size={12} className="shrink-0 text-gray-500" />
      {label}
    </div>
  );
}

export function AuthorBooksSidebar() {
  const { apiFetch, token } = useApi();
  const pathname = usePathname();
  const { id: routeId } = useParams<{ id?: string }>();
  const [books, setBooks] = useState<SidebarBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(routeId ?? null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: SidebarBook[] }>("/api/books")
      .then(({ books }) => setBooks(books))
      .catch((e) => console.error("[AuthorBooksSidebar] failed to load:", e))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (routeId) setExpandedBookId(routeId);
  }, [routeId]);

  return (
    <aside className="w-[280px] shrink-0 border-r border-gray-200 bg-white sticky top-0 h-screen overflow-y-auto">
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">Ще немає книг</div>
      ) : (
        <div>
          {books.map((book) => {
            const status = BOOK_STATUS_LABELS[book.status] ?? BOOK_STATUS_LABELS.DRAFT;
            const isExpanded = expandedBookId === book.id;
            return (
              <div key={book.id} className="border-b border-gray-200">
                <div
                  className="flex h-[65px] items-center gap-3 px-4 cursor-pointer bg-white hover:bg-gray-50"
                  onClick={() => setExpandedBookId((prev) => (prev === book.id ? null : book.id))}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt=""
                      className="h-[35px] w-[22px] shrink-0 object-cover shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]"
                    />
                  ) : (
                    <div className="flex h-[35px] w-[22px] shrink-0 items-center justify-center bg-white text-xs shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]">
                      📖
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/books/${book.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-[14px] font-bold text-black hover:underline"
                    >
                      {book.title}
                    </Link>
                    <p className="text-[10px] text-black">{status.label}</p>
                  </div>
                </div>

                {isExpanded && (
                  <nav className="bg-[#f3f3f3] py-1">
                    {TOP_ITEMS.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} />
                    ))}

                    <GroupLabel label="Редагувати книгу" />
                    {EDIT_GROUP.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} />
                    ))}

                    <GroupLabel label="Ваша книга у магазинах" />
                    {STORE_GROUP.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} />
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
