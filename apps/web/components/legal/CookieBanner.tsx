"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_KEY = "knyha_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900 text-gray-100 shadow-2xl">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-6 py-4">
        <p className="flex-1 text-sm leading-relaxed">
          Ми використовуємо файли cookie для покращення роботи сайту, аналітики та персоналізації.
          Докладніше у нашій{" "}
          <Link href="/privacy" className="underline hover:text-white transition-colors">
            Політиці конфіденційності
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={decline}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Відхилити
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Прийняти
          </button>
        </div>
      </div>
    </div>
  );
}
