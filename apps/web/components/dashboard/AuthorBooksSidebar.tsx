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
import { getBookStatusLabel } from "@/lib/bookStatus";
import { cn } from "@/lib/utils";
import { DeleteBookModal } from "@/components/books/DeleteBookModal";
import { AuthorSidebarNavUser } from "@/components/dashboard/AuthorSidebarNavUser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

interface SidebarBook {
  id: string;
  title: string;
  coverUrl?: string | null;
  status: string;
  publicationTimeline?: Record<string, string> | null;
  needsAttention?: boolean;
}

type SubNavItem =
  | { label: string; href: (bookId: string) => string; icon?: React.ReactNode; disabled?: false; action?: undefined }
  | { label: string; icon?: React.ReactNode; disabled: true; action?: undefined }
  | { label: string; icon?: React.ReactNode; action: "delete"; disabled?: false };

const TOP_ITEMS: SubNavItem[] = [
  {
    label: "Завантажити файли",
    icon: <Download size={14} />,
    disabled: true,
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
  // T-2076 -- renamed from "Передперегляд" to "PDF для друку": authors
  // didn't realize opening the route (print-preview.ts) actually generates
  // the print PDF, "Передперегляд" alone didn't convey that.
  // Renamed again on author feedback -- "PDF для друку" read the opposite
  // way: authors assumed it was a technical/production artifact, not
  // something meant for them to look at, and avoided it. "Передперегляд
  // книги" -- unified across every place that links here (this sidebar
  // item, the editor toolbar button, the cover editor link, the ISBN
  // checklist link, FormatsAndDistribution's hint, output-data's own
  // manuscript-section hint, and PublicationTimeline's). The generation
  // side-effect is still called out separately wherever a label needs to
  // convey it (e.g. "Відкрити «Передперегляд книги» (згенерує його) →").
  { label: "Передперегляд книги", icon: <FileText size={14} />, href: (id) => `/dashboard/books/${id}/manuscript/preview` },
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
      <Button
        type="button"
        variant="ghost"
        onClick={() => onDeleteClick(bookId)}
        className="h-[2rem] w-full justify-start gap-2.5 rounded-none pl-12 pr-8 text-left text-[0.875rem] font-medium text-black hover:bg-[#e9e9e9] hover:text-black"
      >
        {iconEl}
        <span className="truncate whitespace-nowrap">{item.label}</span>
      </Button>
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
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-[2rem] w-full justify-start gap-1 rounded-none px-8 text-left text-[0.875rem] font-normal text-black hover:bg-transparent hover:text-black"
    >
      <img
        src="/figma/chevron-collapse.svg"
        alt=""
        className={cn("h-2 w-3 shrink-0 transition-transform", expanded ? "rotate-180" : "rotate-90")}
      />
      <span className="truncate whitespace-nowrap">{label}</span>
    </Button>
  );
}

interface Props {
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
}

export function AuthorBooksSidebar({ user }: Props) {
  const { apiFetch, token } = useApi();
  const pathname = usePathname();
  const router = useRouter();
  const { id: routeId } = useParams<{ id?: string }>();
  const { state: sidebarState } = useSidebar();
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

  // Collapsed to the icon rail, the per-book accordion below is hidden
  // (group-data-[collapsible=icon]:hidden -- there's no room for it) --
  // clicking a book's cover there would otherwise be a dead click with no
  // visible effect, so it navigates straight to the book instead of toggling
  // the (invisible) accordion. Expanded, it toggles like before.
  function handleBookRowClick(bookId: string) {
    if (sidebarState === "collapsed") {
      router.push(`/dashboard/books/${bookId}`);
      return;
    }
    setExpandedBookId((prev) => (prev === bookId ? null : bookId));
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
        <Button
          asChild
          className="h-9 w-full gap-1.5 bg-[#50a406] text-[0.875rem] font-medium hover:bg-[#458c05] group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:px-0"
          title="Створити нову книжку"
        >
          <Link href="/dashboard/books/new">
            <Plus size={14} className="shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">Створити нову книжку</span>
          </Link>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-[0.75rem] text-red-500">Не вдалося завантажити книги</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => load()}
                  className="mt-2 h-auto px-2 py-1 text-[0.75rem] text-gray-600"
                >
                  Спробувати ще раз
                </Button>
              </div>
            ) : books.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">Ще немає книг</div>
            ) : (
              <SidebarMenu>
                {books.map((book) => {
                  const status = getBookStatusLabel(book.status, book.publicationTimeline);
                  const isExpanded = expandedBookId === book.id;
                  return (
                    <SidebarMenuItem key={book.id} className="border-b border-gray-200">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleBookRowClick(book.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleBookRowClick(book.id);
                          }
                        }}
                        title={book.title}
                        className="relative flex h-[65px] items-center gap-3 px-8 cursor-pointer bg-white hover:bg-gray-50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                      >
                        {book.needsAttention && (
                          <span
                            title="Потребує уваги: є зауваження модератора або не всі кроки заповнені"
                            className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white group-data-[collapsible=icon]:right-1"
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
                        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                          <Link
                            href={`/dashboard/books/${book.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate hover:underline"
                          >
                            <h2 className="truncate">{book.title}</h2>
                          </Link>
                          <Badge
                            className={cn(
                              "mt-0.5 rounded-full border-transparent px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none",
                              status.className
                            )}
                          >
                            {status.label}
                          </Badge>
                        </div>
                      </div>

                      {isExpanded && (
                        <nav className="bg-[#f3f3f3] py-1 group-data-[collapsible=icon]:hidden">
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
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user && <AuthorSidebarNavUser user={user} />}
      </SidebarFooter>

      <SidebarRail />

      {deleteBookId && (
        <DeleteBookModal
          bookId={deleteBookId}
          bookStatus={books.find((b) => b.id === deleteBookId)?.status}
          onClose={() => setDeleteBookId(null)}
          onDeleted={() => {
            const wasViewingDeleted = routeId === deleteBookId;
            setDeleteBookId(null);
            load();
            // MyBooksList ("Мої книги" в основному контенті) рендериться
            // поруч із цим сайдбаром і має власний незалежний fetch --
            // без цього повідомлення воно й далі показувало щойно видалену
            // книгу, поки хтось не перезавантажить сторінку вручну.
            window.dispatchEvent(new Event("ulit:books-changed"));
            if (wasViewingDeleted) router.push("/dashboard/books");
          }}
        />
      )}
    </Sidebar>
  );
}
