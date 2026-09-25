"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { getBookStatusLabel } from "../../lib/bookStatus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Book {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: string;
  coverUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  genre?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  printPageCount?: number | null;
  createdAt: string;
  publishedAt?: string | null;
  publicationTimeline?: Record<string, string> | null;
}

interface Props {
  book: Book;
  onDelete?: (id: string) => void;
  needsAttention?: boolean;
}

export function BookCard({ book, onDelete, needsAttention }: Props) {
  const status = getBookStatusLabel(book.status, book.publicationTimeline);
  // Prefer the real print-trim page count (T-2057, printPdfUrl) over the
  // online-viewer estimate (pageCount, derived from Word's own page size) --
  // same fallback print-cost.ts already uses, so the number matches what the
  // author saw there.
  const pages = book.printPageCount ?? book.pageCount;

  return (
    <Card className="group relative flex gap-4 p-4 shadow-sm transition hover:shadow-md">
      {/* Cover */}
      <div className="flex-shrink-0">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="h-32 w-24 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-md bg-gray-100 text-3xl">
            📖
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link href={`/dashboard/books/${book.id}`} className="min-w-0 hover:underline">
              <h2 className="truncate">{book.title}</h2>
            </Link>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {needsAttention && (
                <Badge
                  title="Є зауваження модератора або не всі кроки на «Вихідних даних» заповнені"
                  className="gap-1 rounded-full border-transparent bg-amber-500 px-2 py-0.5 text-[0.75rem] font-semibold text-white hover:bg-amber-500"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  Потребує уваги
                </Badge>
              )}
              <Badge className={cn("rounded-full border-transparent px-2.5 py-0.5 text-[0.8125rem] font-medium", status.className)}>
                {status.label}
              </Badge>
            </div>
          </div>

          {book.genre && <h3 className="mt-0.5 font-normal text-gray-500">{book.genre}</h3>}

          {book.description && (
            <h3 className="mt-1.5 font-normal text-gray-600 line-clamp-2">{book.description}</h3>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-gray-500">
            {pages && <span>{pages} стор.</span>}
            {book.priceEbook && <span>Е-книга: {Number(book.priceEbook).toFixed(0)} грн</span>}
            {book.pricePrint && <span>Друк (м&apos;яка): {Number(book.pricePrint).toFixed(0)} грн</span>}
            {book.pricePrintHardcover && <span>Друк (тверда): {Number(book.pricePrintHardcover).toFixed(0)} грн</span>}
            {book.isbn && <span>ISBN: {book.isbn}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/books/${book.id}`}>Відкрити</Link>
            </Button>
            {onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Інші дії">
                    ⋯
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(book.id)}
                  >
                    Видалити
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
