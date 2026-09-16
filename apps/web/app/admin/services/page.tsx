"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../hooks/useApi";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";

interface Services {
  d2d: boolean;
  kdp: boolean;
  google: boolean;
}

const SERVICE_INFO = [
  {
    key: "d2d" as const,
    name: "Draft2Digital",
    icon: "📚",
    desc: "Apple Books, Barnes & Noble, Kobo, Scribd, OverDrive та інші",
    color: "blue",
  },
  {
    key: "kdp" as const,
    name: "Amazon KDP",
    icon: "📦",
    desc: "Kindle Direct Publishing — найбільша платформа електронних книг",
    color: "orange",
  },
  {
    key: "google" as const,
    name: "Google Play Books",
    icon: "🔍",
    desc: "Google Books Partner Program — мільярди пристроїв Android",
    color: "green",
  },
];

export default function ServicesPage() {
  const { apiFetch, token } = useApi();
  const [services, setServices] = useState<Services>({ d2d: true, kdp: true, google: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ services: Services }>("/api/admin/settings")
      .then((d) => setServices(d.services))
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleService(key: keyof Services) {
    const next = { ...services, [key]: !services[key] };
    setSaving(true);
    try {
      const data = await apiFetch<{ services: Services }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ services: { [key]: next[key] } }),
      });
      setServices(data.services);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Сервіси дистрибуції</h1>
        <p className="text-sm text-gray-500 mt-1">
          Увімкніть або вимкніть кожен сервіс. Вимкнені сервіси не з&apos;являтимуться в черзі дистрибуції.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SERVICE_INFO.map((svc) => (
            <Card
              key={svc.key}
              className={`p-5 shadow-sm flex items-center justify-between transition-opacity ${
                !services[svc.key] ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{svc.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900">{svc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-sm">{svc.desc}</p>
                </div>
              </div>

              <Switch
                checked={services[svc.key]}
                onCheckedChange={() => toggleService(svc.key)}
                disabled={saving}
                className="data-[state=checked]:bg-green-500"
              />
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        ⚠️ Зміни набирають чинності негайно, але зберігаються лише до перезапуску сервера.
        Для постійного збереження — внесіть значення в змінні середовища.
      </div>
    </div>
  );
}
