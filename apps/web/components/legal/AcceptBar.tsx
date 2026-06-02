"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useApi } from "../../hooks/useApi";

export function AcceptBar() {
  const { data: session, status } = useSession();
  const { apiFetch } = useApi();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { setChecked(true); return; }

    apiFetch<{ user: { contractAcceptedAt: string | null } }>("/api/users/me")
      .then((d) => {
        if (d.user.contractAcceptedAt) setAccepted(true);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [status, session]);

  async function handleAccept() {
    if (!session) {
      router.push("/login?callbackUrl=/author-agreement");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/users/me/accept-agreement", { method: "POST" });
      setAccepted(true);
    } catch {
      alert("Помилка. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  }

  if (!checked) return null;

  if (accepted) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 bg-green-700 text-white">
        <div className="mx-auto max-w-4xl flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium">
          Договір прийнято
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-white shadow-2xl">
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-6 py-4">
        <p className="flex-1 text-sm text-gray-700">
          Натискаючи «Прийняти договір», ви підтверджуєте, що ознайомились з умовами та погоджуєтесь з ними.
          {!session && (
            <span className="ml-1 text-gray-500">(Потрібна авторизація)</span>
          )}
        </p>
        <button
          onClick={handleAccept}
          disabled={loading}
          className="shrink-0 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Збереження…" : session ? "Прийняти договір" : "Увійти та прийняти"}
        </button>
      </div>
    </div>
  );
}
