"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "../../../../components/ui/button";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resendState, setResendState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleResend = async () => {
    setResendState("loading");
    try {
      await fetch("/api/users/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendState("done");
    } catch {
      setResendState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-gray-900">Перевірте пошту</h1>
          <p className="mt-2 text-gray-600">
            Ми надіслали лист із посиланням для підтвердження на{" "}
            {email && <strong className="text-gray-900">{email}</strong>}
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4 text-left">
          <p className="text-sm text-gray-600">
            Натисніть кнопку <strong>«Підтвердити email»</strong> у листі. Посилання дійсне <strong>24 години</strong>.
          </p>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Не знайшли лист? Перевірте папку «Спам».
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-3">Лист не надійшов?</p>
            {resendState === "done" ? (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                Лист надіслано повторно. Перевірте пошту.
              </div>
            ) : resendState === "error" ? (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                Помилка. Спробуйте ще раз.
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                loading={resendState === "loading"}
              >
                Надіслати повторно
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-500">
          <Link href="/login" className="text-primary hover:underline font-medium">
            Повернутись до входу
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
