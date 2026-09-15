"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uk">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-bold text-gray-900">Щось пішло не так</h1>
          <p className="text-sm text-gray-500">
            Помилку зафіксовано, ми вже над нею працюємо.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Спробувати ще раз
          </button>
        </div>
      </body>
    </html>
  );
}
