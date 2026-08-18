"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useBook } from "@/hooks/useBook";
import { cn } from "@/lib/utils";
import { RepublishButton } from "@/components/books/RepublishButton";
import { UnpublishButton } from "@/components/books/UnpublishButton";
import { RelistButton } from "@/components/books/RelistButton";

interface DistributionBook {
  title: string;
  coverUrl?: string | null;
  status: string;
  priceEbook?: string | number | null;
  pricePrint?: string | number | null;
  pricePrintHardcover?: string | number | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  republishRequestedAt?: string | null;
}

interface ChannelStatus {
  status: "NOT_SENT" | "SENT" | "PUBLISHED" | "ERROR";
  sentAt: string | null;
  blocked: boolean;
}

interface DistributionInfo {
  distributionStrategy: "WIDE" | "KDP_SELECT";
  distributionChannels: string[];
  kdpSelectEnrolled: boolean;
  kdpSelectExpiry: string | null;
  kdpSelectDaysLeft: number | null;
  kdpSelectActive: boolean;
  services: { d2d: ChannelStatus; kdp: ChannelStatus; google: ChannelStatus };
}

const STORES = [
  {
    key: "ULIT",
    icon: "📚",
    name: "Магазин Ulit",
    royalty: "70%",
    formats: "Електронна та друкована книга",
  },
  {
    key: "D2D",
    icon: "🌐",
    name: "Draft2Digital",
    royalty: "60%",
    formats: "Електронна книга — 40+ рітейлерів (Barnes & Noble, Kobo, Apple Books та інші)",
  },
  {
    key: "KDP",
    icon: "🔶",
    name: "Amazon KDP",
    royalty: "35–70%",
    formats: "Електронна книга — Amazon Kindle Store",
  },
  {
    key: "GOOGLE",
    icon: "🎮",
    name: "Google Play Books",
    royalty: "52%",
    formats: "Електронна книга",
  },
] as const;

const STATUS_LABEL: Record<ChannelStatus["status"], { label: string; className: string }> = {
  NOT_SENT: { label: "Не надіслано", className: "bg-gray-100 text-gray-500" },
  SENT: { label: "Надіслано", className: "bg-amber-50 text-amber-700" },
  PUBLISHED: { label: "Опубліковано", className: "bg-green-50 text-green-700" },
  ERROR: { label: "Помилка", className: "bg-red-50 text-red-700" },
};

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export function BookDistribution() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const { book, setBook, loading: bookLoading } = useBook<DistributionBook>(id);
  const [info, setInfo] = useState<DistributionInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<DistributionInfo>(`/api/books/${id}/distribution`)
      .then(setInfo)
      .catch(() => {})
      .finally(() => setInfoLoading(false));
  }, [token, id]);

  if (bookLoading || infoLoading) {
    return (
      <div className="p-8">
        <div className="h-96 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }
  if (!book || !info) return null;

  const everPublished = !!book.publishedAt;
  const isPublished = book.status === "PUBLISHED";
  const isUnpublished = book.status === "UNPUBLISHED";
  const hasChanges = !!book.docxUpdatedAt && (!book.publishedAt || book.docxUpdatedAt > book.publishedAt);

  const ulitStatus: { label: string; className: string } = isPublished
    ? { label: "Опубліковано", className: "bg-green-50 text-green-700" }
    : isUnpublished
    ? { label: "Знято з публікації", className: "bg-gray-100 text-gray-500" }
    : { label: "Не опубліковано", className: "bg-gray-100 text-gray-500" };

  const channelByKey: Record<string, ChannelStatus | null> = {
    ULIT: null, // Ulit is the site itself — status derives from book.status, not the /distribution services map
    D2D: info.services.d2d,
    KDP: info.services.kdp,
    GOOGLE: info.services.google,
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[1.4375rem] font-bold text-black">Публікація у магазинах</h1>
            <p className="mt-1 text-sm text-gray-500">«{book.title}»</p>
          </div>
          <Link
            href={`/dashboard/books/${id}/output-data#section-price`}
            className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50"
          >
            Змінити платформи та ціни
          </Link>
        </div>

        {!everPublished && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Книга ще не опублікована — нижче показано, куди вона потрапить після проходження модерації.
          </div>
        )}

        {info.kdpSelectActive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="font-semibold">KDP Select активний</span>
            {info.kdpSelectDaysLeft != null && <> — залишилось {info.kdpSelectDaysLeft} дн.</>} Draft2Digital і
            Google Play Books недоступні до завершення терміну ексклюзивності.
          </div>
        )}

        <div className="overflow-hidden rounded-xl border shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Магазин</th>
                <th className="px-4 py-3 text-left font-semibold">Формат</th>
                <th className="px-4 py-3 text-left font-semibold">Роялті</th>
                <th className="px-4 py-3 text-left font-semibold">Статус</th>
                <th className="px-4 py-3 text-left font-semibold">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {STORES.map((store) => {
                const included = info.distributionChannels.includes(store.key);
                const channel = channelByKey[store.key];
                const status = store.key === "ULIT" ? ulitStatus : STATUS_LABEL[channel?.status ?? "NOT_SENT"];
                const blocked = channel?.blocked ?? false;
                return (
                  <tr key={store.key} className={cn(!included && "opacity-50")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{store.icon}</span>
                        <span className="font-medium text-gray-900">{store.name}</span>
                        {!included && <span className="text-xs text-gray-400">(вимкнено)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{store.formats}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{store.royalty}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>
                        {blocked && included ? "Заблоковано (KDP Select)" : status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {store.key === "ULIT"
                        ? book.publishedAt
                          ? fmtDate(book.publishedAt)
                          : "—"
                        : channel?.sentAt
                        ? fmtDate(channel.sentAt)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(book.priceEbook || book.pricePrint || book.pricePrintHardcover) && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm font-semibold text-gray-900">Ціна на Ulit</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
              {book.priceEbook && <span>Електронна — {Number(book.priceEbook).toFixed(0)} грн</span>}
              {book.pricePrint && <span>Друк, м&rsquo;яка — {Number(book.pricePrint).toFixed(0)} грн</span>}
              {book.pricePrintHardcover && <span>Друк, тверда — {Number(book.pricePrintHardcover).toFixed(0)} грн</span>}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Ціни на зовнішніх майданчиках (D2D, KDP, Google Play Books) формуються кожним магазином окремо.
            </p>
          </div>
        )}

        {isPublished && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">
              {hasChanges ? "Ви змінили параметри книги" : "Керування публікацією"}
            </p>
            <p className="text-sm text-gray-600">
              {hasChanges
                ? "Щоб опублікувати зміни у магазинах, надішліть книгу на повторну модерацію — після схвалення адміністратором оновлені файли підуть у всі увімкнені магазини."
                : "Книга опублікована в усіх увімкнених магазинах. Ви можете зняти її з продажу в будь-який момент — файли, ISBN і налаштування збережуться."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <RepublishButton
                bookId={id}
                docxUpdatedAt={book.docxUpdatedAt}
                publishedAt={book.publishedAt}
                republishRequestedAt={book.republishRequestedAt}
                onSubmitted={(republishRequestedAt) =>
                  setBook((b) => (b ? { ...b, republishRequestedAt } : b))
                }
              />
              <UnpublishButton bookId={id} onUnpublished={() => setBook((b) => (b ? { ...b, status: "UNPUBLISHED" } : b))} />
            </div>
          </div>
        )}

        {isUnpublished && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Книга знята з публікації</p>
            <p className="text-sm text-gray-600">
              Файли, ISBN і налаштування магазинів збережені — публікацію можна відновити будь-коли.
            </p>
            <RelistButton bookId={id} onRelisted={() => setBook((b) => (b ? { ...b, status: "PUBLISHED" } : b))} />
          </div>
        )}
      </div>
    </div>
  );
}
