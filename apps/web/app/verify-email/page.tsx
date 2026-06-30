"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "../../components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<"loading" | "success" | "expired" | "invalid">("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    fetch(`/api/users/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setState("success");
          setTimeout(() => router.push("/login?verified=1"), 2500);
        } else if (data.code === "TOKEN_EXPIRED") {
          setState("expired");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [token, router]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendState("loading");
    await fetch("/api/users/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    setResendState("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md text-center space-y-6">

        {state === "loading" && (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-semibold text-gray-700">Перевіряємо посилання…</h1>
          </>
        )}

        {state === "success" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900">Email підтверджено!</h1>
            <p className="text-gray-600">Зараз вас перенаправить на сторінку входу…</p>
          </>
        )}

        {state === "expired" && (
          <div className="bg-white rounded-xl border shadow-sm p-8 space-y-4">
            <div className="text-5xl mb-2">⌛</div>
            <h1 className="text-2xl font-bold text-gray-900">Посилання застаріло</h1>
            <p className="text-gray-600 text-sm">
              Термін дії посилання вичерпано. Введіть email щоб отримати нове.
            </p>
            {resendState === "done" ? (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                Новий лист надіслано. Перевірте пошту.
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <Button
                  className="w-full"
                  onClick={handleResend}
                  loading={resendState === "loading"}
                  disabled={!resendEmail}
                >
                  Надіслати новий лист
                </Button>
              </div>
            )}
            <Link href="/login" className="text-sm text-primary hover:underline block mt-2">
              Повернутись до входу
            </Link>
          </div>
        )}

        {state === "invalid" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900">Недійсне посилання</h1>
            <p className="text-gray-600 text-sm">
              Посилання вже використане або некоректне.
            </p>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Повернутись до входу
            </Link>
          </>
        )}

      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
