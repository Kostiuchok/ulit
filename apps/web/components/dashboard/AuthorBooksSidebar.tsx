"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import {
  Package,
  MessageSquare,
  Download,
  ImagePlus,
  FileText,
  BarChart3,
  Users,
  Percent,
  Trash2,
  Info,
  Plus,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useNotifications } from "@/hooks/useNotifications";
import { getBookStatusLabel } from "@/lib/bookStatus";
import { cn } from "@/lib/utils";
import { DeleteBookModal } from "@/components/books/DeleteBookModal";

interface SidebarBook {
  id: string;
  title: string;
  coverUrl?: string | null;
  status: string;
  publicationTimeline?: Record<string, string> | null;
}

type SubNavItem =
  | { label: string; href: (bookId: string) => string; icon?: React.ReactNode; disabled?: false; action?: undefined }
  | { label: string; icon?: React.ReactNode; disabled: true; action?: undefined }
  | { label: string; icon?: React.ReactNode; action: "delete"; disabled?: false };

const TOP_ITEMS: SubNavItem[] = [
  {
    label: "Завантажити файли",
    icon: <Download size={14} />,
    href: (id) => `/dashboard/books/${id}/published`,
  },
];

const EDIT_GROUP: SubNavItem[] = [
  { label: "Вихідні дані", icon: <Info size={14} />, href: (id) => `/dashboard/books/${id}/output-data` },
  {
    label: "Рукопис",
    icon: <img src="/figma/icon-text-edit.svg" alt="" className="h-3.5 w-3.5" />,
    href: (id) => `/dashboard/books/${id}/manuscript`,
  },
  { label: "Обкладинка", icon: <ImagePlus size={14} />, href: (id) => `/dashboard/books/${id}/cover` },
  // T-2057 -- one real preview, not two: this used to point at the old
  // page-thumbnail flipbook (`(withSidebar)/[id]/preview`), a separate,
  // unrelated render pipeline from the one the manuscript editor's own
  // button used. Both now point at the same route.
  // T-2076 -- renamed from "Передперегляд": this is the same route that
  // lazily generates the print PDF on open (print-preview.ts), a fact
  // "Передперегляд" alone didn't convey -- unified across every place that
  // links here (this sidebar item, the editor toolbar button, the cover
  // editor link, the ISBN checklist link, FormatsAndDistribution's hint,
  // output-data's own manuscript-section hint, and PublicationTimeline's).
  { label: "Друкований PDF", icon: <FileText size={14} />, href: (id) => `/dashboard/books/${id}/manuscript/preview` },
  { label: "Видалити", icon: <Trash2 size={14} />, action: "delete" },
];

const STORE_GROUP: SubNavItem[] = [
  {
    label: "Публікація у магазинах",
    icon: <img src="/figma/icon-publication.svg" alt="" className="h-3.5 w-3.5" />,
    href: (id) => `/dashboard/books/${id}/publish`,
  },
  { label: "Статистика", icon: <BarChart3 size={14} />, disabled: true },
];

const PROMO_GROUP: SubNavItem[] = [
  { label: "Замовити тираж", icon: <Package size={14} />, href: (id) => `/dashboard/books/${id}/print-order` },
  { label: "Обговорення книги", icon: <MessageSquare size={14} />, disabled: true },
  { label: "Знайти нових читачів", icon: <Users size={14} />, disabled: true },
  { label: "Включити акцію на книгу", icon: <Percent size={14} />, disabled: true },
];

function NavRow({
  item,
  bookId,
  pathname,
  onDeleteClick,
}: {
  item: SubNavItem;
  bookId: string;
  pathname: string;
  onDeleteClick: (bookId: string) => void;
}) {
  const iconEl = item.icon ? <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-gray-500">{item.icon}</span> : null;

  if (item.disabled) {
    return (
      <div
        title="Функція в розробці"
        className="flex h-[2rem] items-center gap-2.5 pl-12 pr-8 text-[0.875rem] text-gray-300 cursor-not-allowed"
      >
        {iconEl}
        <span className="flex-1 truncate whitespace-nowrap">{item.label}</span>
        <span className="shrink-0 rounded-sm bg-gray-200/60 px-1 py-px text-[0.6875rem] text-gray-400">скоро</span>
      </div>
    );
  }

  if (item.action === "delete") {
    return (
      <button
        type="button"
        onClick={() => onDeleteClick(bookId)}
        className="flex h-[2rem] w-full items-center gap-2.5 pl-12 pr-8 text-left text-[0.875rem] font-medium text-black transition-colors hover:bg-[#e9e9e9]"
      >
        {iconEl}
        <span className="truncate whitespace-nowrap">{item.label}</span>
      </button>
    );
  }

  const href = item.href(bookId);
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex h-[2rem] items-center gap-2.5 pl-12 pr-8 text-[0.875rem] font-medium transition-colors",
        active ? "bg-[#e3e3e3] text-black" : "text-black hover:bg-[#e9e9e9]"
      )}
    >
      {iconEl}
      <span className="truncate whitespace-nowrap">{item.label}</span>
    </Link>
  );
}

function GroupLabel({ label, expanded, onClick }: { label: string; expanded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[2rem] w-full items-center gap-1 px-8 text-left text-[0.875rem] text-black"
    >
      <img
        src="/figma/chevron-collapse.svg"
        alt=""
        className={cn("h-2 w-3 shrink-0 transition-transform", expanded ? "rotate-180" : "rotate-90")}
      />
      <span className="truncate whitespace-nowrap">{label}</span>
    </button>
  );
}

export function AuthorBooksSidebar() {
  const { apiFetch, token } = useApi();
  const { unreadBookIds } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const { id: routeId } = useParams<{ id?: string }>();
  const [books, setBooks] = useState<SidebarBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(routeId ?? null);
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [promoOpen, setPromoOpen] = useState(true);

  function load(opts?: { silent?: boolean }) {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    apiFetch<{ books: SidebarBook[] }>("/api/books")
      .then(({ books }) => {
        setBooks(books);
        setError(null);
      })
      .catch((e: any) => { if (!opts?.silent) setError(e.message || "Помилка завантаження"); })
      .finally(() => { if (!opts?.silent) setLoading(false); });
  }

  useEffect(load, [token]);

  useEffect(() => {
    if (routeId) setExpandedBookId(routeId);
  }, [routeId]);

  // Pages that mutate a book (e.g. PublishButton's "Надіслати на модерацію")
  // fire this event so the sidebar's own independently-fetched status badge
  // stays in sync -- it has no other way to learn about a change made
  // elsewhere in the same tab (no navigation, no window blur/refocus, so the
  // useBook.ts focus-refetch pattern doesn't apply here). Silent: this must
  // NOT flip the whole sidebar back to its loading skeleton mid-interaction.
  useEffect(() => {
    function onBooksChanged() { load({ silent: true }); }
    window.addEventListener("ulit:books-changed", onBooksChanged);
    return () => window.removeEventListener("ulit:books-changed", onBooksChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
      <div className="shrink-0 border-b border-gray-200 p-4">
        <Link
          href="/dashboard/books/new"
          className="flex h-[36px] items-center justify-center gap-1.5 rounded-md bg-[#50a406] text-[0.875rem] font-medium text-white hover:bg-[#458c05]"
        >
          <Plus size={14} />
          Створити нову книжку
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 text-center">
          <p className="text-[0.75rem] text-red-500">Не вдалося завантажити книги</p>
          <button
            onClick={() => load()}
            className="mt-2 rounded border border-gray-300 px-2 py-1 text-[0.75rem] text-gray-600 hover:bg-gray-50"
          >
            Спробувати ще раз
          </button>
        </div>
      ) : books.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">Ще немає книг</div>
      ) : (
        <div>
          {books.map((book) => {
            const status = getBookStatusLabel(book.status, book.publicationTimeline);
            const isExpanded = expandedBookId === book.id;
            return (
              <div key={book.id} className="border-b border-gray-200">
                <div
                  className="relative flex h-[65px] items-center gap-3 px-8 cursor-pointer bg-white hover:bg-gray-50"
                  onClick={() => setExpandedBookId((prev) => (prev === book.id ? null : book.id))}
                >
                  {unreadBookIds.has(book.id) && (
                    <span
                      title="Нове сповіщення"
                      className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-[#ff5900] ring-2 ring-white"
                    />
                  )}
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
                      className="block truncate hover:underline"
                    >
                      <h2 className="truncate">{book.title}</h2>
                    </Link>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <nav className="bg-[#f3f3f3] py-1">
                    <GroupLabel label="Редагувати книгу" expanded={editOpen} onClick={() => setEditOpen((v) => !v)} />
                    {editOpen && EDIT_GROUP.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} onDeleteClick={setDeleteBookId} />
                    ))}

                    <GroupLabel label="Ваша книга у магазинах" expanded={storeOpen} onClick={() => setStoreOpen((v) => !v)} />
                    {storeOpen && STORE_GROUP.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} onDeleteClick={setDeleteBookId} />
                    ))}

                    {TOP_ITEMS.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} onDeleteClick={setDeleteBookId} />
                    ))}

                    <GroupLabel label="Реклама" expanded={promoOpen} onClick={() => setPromoOpen((v) => !v)} />
                    {promoOpen && PROMO_GROUP.map((item) => (
                      <NavRow key={item.label} item={item} bookId={book.id} pathname={pathname} onDeleteClick={setDeleteBookId} />
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {deleteBookId && (
        <DeleteBookModal
          bookId={deleteBookId}
          onClose={() => setDeleteBookId(null)}
          onDeleted={() => {
            const wasViewingDeleted = routeId === deleteBookId;
            setDeleteBookId(null);
            load();
            if (wasViewingDeleted) router.push("/dashboard/books");
          }}
        />
      )}
    </aside>
  );
}
