"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { cn } from "../../../lib/utils";

type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "CANCELLED";

interface AdminOrder {
  id: string;
  total: number;
  status: OrderStatus;
  paymentId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  items: { id: string; format: string; price: number; book: { title: string } }[];
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Усі" },
  { value: "PENDING", label: "Очікує" },
  { value: "PAID", label: "Сплачено" },
  { value: "FULFILLED", label: "Виконано" },
  { value: "CANCELLED", label: "Скасовано" },
];

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

export default function AdminOrdersPage() {
  const { apiFetch, token } = useApi();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      const params = filter ? `?status=${filter}` : "";
      return apiFetch<{ orders: AdminOrder[] }>(`/api/admin/orders${params}`)
        .then((d) => setOrders(d.orders))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [token, apiFetch, filter]
  );

  useEffect(() => {
    load();
  }, [load]);
  useRefetchOnFocus(useCallback(() => load({ silent: true }), [load]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Замовлення</h1>
        <p className="text-sm text-gray-500 mt-1">
          Усі покупки в магазині Ulit. Замовлення зі статусом «Очікує» скасовуються автоматично через 24 години.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
            type="button"
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-gray-500">Ще немає замовлень</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Покупець</TableHead>
                <TableHead>Позиції</TableHead>
                <TableHead>Сума</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="whitespace-nowrap text-sm text-gray-600">
                    <Link href={`/admin/orders/${order.id}`} className="text-blue-700 hover:underline">
                      {new Date(order.createdAt).toLocaleString("uk-UA")}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.user.name}</div>
                    <div className="text-xs text-gray-500">{order.user.email}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {order.items.length} · {order.items.map((i) => i.book.title).join(", ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{order.total.toFixed(2)} грн</TableCell>
                  <TableCell>
                    <Badge className={cn("font-normal", STATUS_BADGE[order.status])}>{STATUS_LABEL[order.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
