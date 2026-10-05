"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { computeCoverLayout } from "@/lib/coverLayout";
import {
  COVER_STYLES,
  COVER_STYLE_GROUPS,
  DEFAULT_COVER_STYLE_ID,
  LONG_TITLE_FALLBACK_STYLE_ID,
  coverStyleForGenre,
  coverStyleLabel,
  findCoverStyle,
  type CoverStyle,
  type CoverTexts,
} from "@/lib/autoCover/styles";
import {
  drawFront,
  drawSpread,
  exportAutoCover,
  loadImage,
  prepareCoverAssets,
  type AutoCoverInput,
  type BackCoverData,
} from "@/lib/autoCover/render";
import { DEFAULT_COVER_BASE_COLOR, coverBaseColorPattern, deriveCoverTheme, formatAuthorFullName } from "shared-types";

export interface AutoCoverBook {
  status?: string | null;
  slug?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  authorBio?: string | null;
  isbn?: string | null;
  bookAuthors?: { lastName?: string; firstName?: string; middleName?: string; photoUrl?: string }[] | null;
  autoCoverStyleId?: string | null;
  autoCoverBaseColor?: string | null;
}

interface Props {
  bookId: string;
  book: AutoCoverBook;
  trimMm: { widthMm: number; heightMm: number };
  pageCount: number | null;
  onApplied: () => void | Promise<void>;
  onUploadOwn: () => void;
  onCancel?: () => void;
}

// The four Figma "Cover theme" modes first, then a few more starting points;
// the native picker next to them takes any colour at all.
const PRESET_COLORS = ["#1F3A5F", "#7A1F2B", "#2F5D46", "#E8D9B5", "#5B2A86", "#111111", "#D94F70", "#F2C14E"];

function authorDisplayName(book: AutoCoverBook): string {
  const a = (book.bookAuthors ?? []).find((x) => x?.lastName?.trim() && x?.firstName?.trim());
  return a ? `${a.firstName} ${a.lastName}`.trim() : "";
}

// A canvas sized in CSS px and drawn at devicePixelRatio. `draw` returns the
// CSS width it wants (the print spread's width depends on the spine).
function CoverCanvas({
  height,
  width,
  draw,
  deps,
  className,
}: {
  height: number;
  width: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  deps: unknown[];
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps]);
  return <canvas ref={ref} style={{ width, height }} className={className} />;
}

export function AutoCoverPicker({ bookId, book, trimMm, pageCount, onApplied, onUploadOwn, onCancel }: Props) {
  const { apiFetch, apiUpload, token } = useApi();
  const genreStyleId = coverStyleForGenre(book.genre);
  const [styleId, setStyleId] = useState(
    () => findCoverStyle(book.autoCoverStyleId ?? genreStyleId ?? DEFAULT_COVER_STYLE_ID).id
  );
  const [baseColor, setBaseColor] = useState(() =>
    book.autoCoverBaseColor && coverBaseColorPattern.test(book.autoCoverBaseColor)
      ? book.autoCoverBaseColor
      : DEFAULT_COVER_BASE_COLOR
  );
  const [view, setView] = useState<"ebook" | "print">("ebook");
  const [hardcover, setHardcover] = useState(false);
  const [photos, setPhotos] = useState<Record<string, CanvasImageSource | null> | null>(null);
  const [back, setBack] = useState<BackCoverData | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const style = findCoverStyle(styleId);
  const index = COVER_STYLES.indexOf(style);
  const theme = useMemo(() => deriveCoverTheme(baseColor), [baseColor]);
  const texts: CoverTexts = useMemo(
    () => ({ title: book.title?.trim() || "Назва книги", author: authorDisplayName(book), subtitle: book.subtitle }),
    [book]
  );
  const isPublished = book.status === "PUBLISHED";

  // Fonts + both template photos once, up front -- the thumbnail strip shows
  // neighbouring templates, so everything is needed anyway.
  useEffect(() => {
    let cancelled = false;
    const sample = `${texts.title} ${texts.author} ${texts.subtitle ?? ""} ${book.description ?? ""} ${book.authorBio ?? ""}`;
    Promise.all(COVER_STYLES.filter((s) => s.photo).map(async (s) => [s.id, await prepareCoverAssets(s, sample)] as const))
      .then((entries) => !cancelled && setPhotos(Object.fromEntries(entries)))
      .catch(() => !cancelled && setPhotos({}));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back cover ("Промо автора") data: all real, all optional -- a block with
  // nothing behind it just isn't drawn.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const photoUrl = (book.bookAuthors ?? []).find((a) => a?.photoUrl?.trim())?.photoUrl;
      const authorPhoto = photoUrl ? await loadImage(photoUrl, true) : null;
      let otherCovers: CanvasImageSource[] = [];
      try {
        const { books } = await apiFetch<{ books: { id: string; status: string; coverThumbUrl?: string | null; coverUrl?: string | null }[] }>("/api/books");
        const urls = books
          .filter((b) => b.id !== bookId && b.status === "PUBLISHED" && (b.coverThumbUrl || b.coverUrl))
          .slice(0, 3)
          .map((b) => (b.coverThumbUrl || b.coverUrl) as string);
        otherCovers = (await Promise.all(urls.map((u) => loadImage(u, true)))).filter((i): i is HTMLImageElement => !!i);
      } catch {
        // The "other books" row is a nice-to-have, never a blocker.
      }
      if (cancelled) return;
      setBack({
        description: book.description,
        authorName: formatAuthorFullName(book.bookAuthors) ?? texts.author,
        authorBio: book.authorBio,
        authorPhoto,
        otherCovers,
        isbn: book.isbn,
        bookUrl: book.slug ? `${window.location.origin}/books/${book.slug}` : null,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bookId]);

  // "Вибір стилю зберігається одразу" -- debounced so dragging the colour
  // picker isn't a PATCH per pixel.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      apiFetch(`/api/books/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({ autoCoverStyleId: styleId, autoCoverBaseColor: baseColor }),
      }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [styleId, baseColor, bookId, apiFetch]);

  const input: AutoCoverInput = {
    styleId,
    baseColor,
    texts,
    back: back ?? { authorName: texts.author },
    pageCount,
    trimMm,
  };

  const ready = photos !== null;
  const ratio = trimMm.heightMm / trimMm.widthMm;
  const PREVIEW_H = 460;
  const frontW = Math.round(PREVIEW_H / ratio);
  const layout = computeCoverLayout(hardcover ? "hardcover" : "softcover", pageCount, trimMm);
  const spreadW = Math.round((layout.totalW / layout.totalH) * PREVIEW_H);

  function go(delta: number) {
    setStyleId(COVER_STYLES[(index + delta + COVER_STYLES.length) % COVER_STYLES.length].id);
  }
  function randomStyle() {
    const others = COVER_STYLES.filter((s) => s.id !== styleId);
    setStyleId(others[Math.floor(Math.random() * others.length)].id);
  }

  // 9 neighbours centred on the current template (wrapping around).
  const strip: CoverStyle[] = Array.from({ length: 9 }, (_, i) => COVER_STYLES[(index - 4 + i + COVER_STYLES.length * 2) % COVER_STYLES.length]);

  async function apply() {
    setApplying(true);
    setError("");
    try {
      const { front, back: backBlob, spine } = await exportAutoCover(input);
      const upload = (blob: Blob, route: string) => {
        const form = new FormData();
        form.append("file", blob, "cover.png");
        return apiUpload(`/api/books/${bookId}/${route}`, form);
      };
      await upload(front, "upload-cover");
      await upload(backBlob, "upload-back-cover");
      await upload(spine, "upload-spine");
      await apiFetch(`/api/books/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({ autoCoverStyleId: styleId, autoCoverBaseColor: baseColor }),
      });
      window.dispatchEvent(new Event("ulit:books-changed"));
      await onApplied();
    } catch (e: any) {
      setError(e.message || "Не вдалося зберегти обкладинку");
    } finally {
      setApplying(false);
    }
  }

  const showGenreChip = !!book.genre && genreStyleId === styleId;
  const showLongHint = overflow && style.group !== "Мінімал";

  return (
    <Card className="space-y-4 p-5 shadow-sm">
      {!isPublished && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          Вибір стилю зберігається одразу, без схвалення адміністратором — книга ще не опублікована. Ліміт «раз на 90
          днів» почне діяти лише після публікації.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">Усі {COVER_STYLES.length}</span>
          {COVER_STYLE_GROUPS.map((g) => {
            const first = COVER_STYLES.find((s) => s.group === g)!;
            const count = COVER_STYLES.filter((s) => s.group === g).length;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setStyleId(first.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  style.group === g ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {g} {count}
              </button>
            );
          })}
        </div>
        <div className="flex rounded-md border border-gray-200 text-xs">
          {(["ebook", "print"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 first:rounded-l-md last:rounded-r-md",
                view === v ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {v === "ebook" ? "Е-книга" : "Друк"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => go(-1)} aria-label="Попередній шаблон">
              <ChevronLeft size={16} />
            </Button>
            <div className="max-w-full overflow-x-auto">
              {!ready ? (
                <div className="animate-pulse rounded bg-gray-200" style={{ width: frontW, height: PREVIEW_H }} />
              ) : view === "ebook" ? (
                <CoverCanvas
                  width={frontW}
                  height={PREVIEW_H}
                  className="rounded-sm shadow-md"
                  deps={[styleId, baseColor, texts, photos]}
                  draw={(ctx, w, h) => setOverflow(drawFront(ctx, w, h, style, theme, texts, photos?.[style.id] ?? null).overflow)}
                />
              ) : (
                <CoverCanvas
                  width={spreadW}
                  height={PREVIEW_H}
                  className="rounded-sm shadow-md"
                  deps={[styleId, baseColor, texts, photos, back, hardcover, pageCount]}
                  draw={(ctx, _w, h) => setOverflow(drawSpread(ctx, h, input, hardcover, photos?.[style.id] ?? null).overflow)}
                />
              )}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => go(1)} aria-label="Наступний шаблон">
              <ChevronRight size={16} />
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900">{coverStyleLabel(style)}</p>
            <p className="text-xs text-gray-500">
              {index + 1} з {COVER_STYLES.length}
              {view === "print" && " · Задня сторона · ↓ корінець · Лицева"}
            </p>
            {showGenreChip && (
              <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[0.6875rem] font-medium text-green-700 ring-1 ring-green-200">
                Підібрано за жанром «{book.genre}»
              </span>
            )}
          </div>

          {view === "print" && (
            <div className="flex justify-center">
              <div className="flex rounded-md border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setHardcover(false)}
                  className={cn("rounded-l-md px-2.5 py-1", !hardcover ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")}
                >
                  М&apos;яка
                </button>
                <button
                  type="button"
                  onClick={() => setHardcover(true)}
                  className={cn("rounded-r-md px-2.5 py-1", hardcover ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")}
                >
                  Тверда
                </button>
              </div>
            </div>
          )}

          {showLongHint && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Назва довга — спробуйте Мінімал
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setStyleId(LONG_TITLE_FALLBACK_STYLE_ID)}>
                Перейти до «Мінімал»
              </Button>
            </div>
          )}

          {ready && (
            <div className="flex justify-center gap-2 overflow-x-auto pb-1">
              {strip.map((s, i) => (
                <button
                  key={`${s.id}-${i}`}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  title={coverStyleLabel(s)}
                  className={cn("shrink-0 rounded-sm border-2 p-0.5", s.id === styleId ? "border-green-600" : "border-transparent hover:border-gray-300")}
                >
                  <CoverCanvas
                    width={48}
                    height={Math.round(48 * ratio)}
                    deps={[s.id, baseColor, texts, photos]}
                    draw={(ctx, w, h) => drawFront(ctx, w, h, s, theme, texts, photos?.[s.id] ?? null)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Колір теми</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBaseColor(c)}
                  aria-label={`Колір ${c}`}
                  className={cn("h-7 w-7 rounded-full border-2", baseColor.toUpperCase() === c ? "border-green-600 ring-2 ring-green-200" : "border-gray-200")}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-gray-300 px-2 text-xs text-gray-600">
                Свій
                <input
                  type="color"
                  value={baseColor}
                  onChange={(e) => setBaseColor(e.target.value.toUpperCase())}
                  className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <p className="text-xs text-gray-400">
              Один колір задає тему всіх {COVER_STYLES.length} шаблонів — фон, акценти й текст підбираються автоматично.
            </p>
          </div>

          <div className="space-y-2">
            <Button type="button" className="w-full" loading={applying} disabled={!ready} onClick={apply}>
              Підходить, використати
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/dashboard/books/${bookId}/cover`}>Редагувати обкладинку</Link>
            </Button>
            <Button type="button" variant="outline" className="w-full gap-1.5" onClick={randomStyle}>
              <Dices size={15} />
              Інший варіант
            </Button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="space-y-1 text-xs">
            <button type="button" onClick={onUploadOwn} className="block text-gray-600 underline hover:no-underline">
              Завантажити свою обкладинку (JPG/PNG)
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="block text-gray-400 underline hover:no-underline">
                Залишити поточну обкладинку
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
