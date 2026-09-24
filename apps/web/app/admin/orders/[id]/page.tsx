"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "../../../../hooks/useApi";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { cn } from "../../../../lib/utils";

type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "CANCELLED";

interface AdminOrderDetail {
  id: string;
  total: number;
  status: OrderStatus;
  paymentId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  items: {
    id: string;
    format: string;
    formats: string[];
    price: number;
    book: { id: string; title: string; slug: string; coverUrl: string | null };
  }[];
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  FULFILLED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Очікує",
  PAID: "Сплачено",
  FULFILLED: "Виконано",
  CANCELLED: "Скасовано",
};

const FORMAT_LABELS: Record<string, string> = {
  EBOOK: "Е-книга",
  PRINT_SOFTCOVER: "Друк, м'яка, колір",
  PRINT_HARDCOVER: "Друк, тверда, колір",
  PRINT_SOFTCOVER_BW: "Друк, м'яка, ч/б",
  PRINT_HARDCOVER_BW: "Друк, тверда, ч/б",
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    return apiFetch<{ order: AdminOrderDetail }>(`/api/admin/orders/${id}`)
      .then((d) => setOrder(d.order))
      .catch((e: { message?: string }) => setError(e.message || "Не вдалося завантажити замовлення"))
      .finally(() => setLoading(false));
  }, [token, apiFetch, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/admin/orders">← До списку</Link>
        </Button>
        <p className="text-red-600">{error || "Замовлення не знайдено"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link href="/admin/orders">← Замовлення</Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Замовлення</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{order.id}</p>
        </div>
        <Badge className={cn("font-normal text-sm", STATUS_BADGE[order.status])}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 shadow-sm">
          <p className="text-xs text-gray-500">Покупець</p>
          <p className="font-medium mt-1">{order.user.name}</p>
          <p className="text-sm text-gray-500">{order.user.email}</p>
        </Card>
        <Card className="p-4 shadow-sm">
          <p className="text-xs text-gray-500">Дата</p>
          <p className="font-medium mt-1">{new Date(order.createdAt).toLocaleString("uk-UA")}</p>
        </Card>
        <Card className="p-4 shadow-sm">
          <p className="text-xs text-gray-500">Оплата</p>
          <p className="font-medium mt-1">{order.total.toFixed(2)} грн</p>
          <p className="text-xs text-gray-500 mt-1">
            {order.paymentId ? `paymentId: ${order.paymentId}` : "Немає paymentId"}
          </p>
        </Card>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Книга</TableHead>
              <TableHead>Формат</TableHead>
              <TableHead>Ціна</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link href={`/admin/books/${item.book.id}/distribute`} className="text-blue-700 hover:underline">
                    {item.book.title}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-gray-700">
                  {FORMAT_LABELS[item.format] ?? item.format}
                  {item.formats.length > 0 ? ` (${item.formats.join(", ")})` : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap">{item.price.toFixed(2)} грн</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
