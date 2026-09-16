"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LiqPayCheckout {
  data: string;
  signature: string;
  action_url: string;
}

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [checkout, setCheckout] = useState<LiqPayCheckout | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(`checkout_${orderId}`);
    if (!raw) {
      setError(true);
      return;
    }
    try {
      const parsed: LiqPayCheckout = JSON.parse(raw);
      setCheckout(parsed);
      sessionStorage.removeItem(`checkout_${orderId}`);
    } catch {
      setError(true);
    }
  }, [orderId]);

  // Auto-submit when form is ready
  useEffect(() => {
    if (checkout && formRef.current) {
      formRef.current.submit();
    }
  }, [checkout]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-5xl">⚠️</p>
          <h1 className="text-xl font-bold text-gray-900">Сесія оплати не знайдена</h1>
          <p className="text-sm text-gray-500">Поверніться до книги та спробуйте ще раз.</p>
          <Button onClick={() => router.back()} className="bg-gray-900 hover:bg-gray-700">
            ← Назад
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-sm text-center space-y-4">
        <div className="text-5xl animate-bounce">💳</div>
        <h1 className="text-xl font-bold text-gray-900">Перехід до оплати…</h1>
        <p className="text-sm text-gray-500">Вас буде перенаправлено на сторінку LiqPay</p>

        {checkout && (
          <form
            ref={formRef}
            method="POST"
            action={checkout.action_url}
            className="hidden"
          >
            <input type="hidden" name="data" value={checkout.data} />
            <input type="hidden" name="signature" value={checkout.signature} />
          </form>
        )}

        {/* Manual submit fallback */}
        {checkout && (
          <form method="POST" action={checkout.action_url}>
            <input type="hidden" name="data" value={checkout.data} />
            <input type="hidden" name="signature" value={checkout.signature} />
            <Button type="submit" className="mt-2 bg-green-600 hover:bg-green-700">
              Перейти до оплати →
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
