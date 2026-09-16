"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Пароль повинен містити мінімум 8 символів"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Паролі не співпадають",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"idle" | "success" | "expired" | "invalid">("idle");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (data: ResetPasswordForm) => {
    const res = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: data.password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus(body.code === "TOKEN_EXPIRED" ? "expired" : "invalid");
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/login"), 2000);
  };

  if (!token) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-8 space-y-4 text-center">
        <div className="text-5xl mb-2">❌</div>
        <h1 className="text-2xl font-bold text-gray-900">Недійсне посилання</h1>
        <p className="text-gray-600 text-sm">Токен для скидання пароля відсутній.</p>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline block">
          Запросити нове посилання
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl mb-2">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Пароль змінено!</h1>
        <p className="text-gray-600">Зараз вас перенаправить на сторінку входу…</p>
      </div>
    );
  }

  if (status === "expired" || status === "invalid") {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-8 space-y-4 text-center">
        <div className="text-5xl mb-2">{status === "expired" ? "⌛" : "❌"}</div>
        <h1 className="text-2xl font-bold text-gray-900">
          {status === "expired" ? "Посилання застаріло" : "Недійсне посилання"}
        </h1>
        <p className="text-gray-600 text-sm">
          {status === "expired"
            ? "Термін дії посилання вичерпано (1 година)."
            : "Посилання вже використане або некоректне."}
        </p>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline block">
          Запросити нове посилання
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password">Новий пароль</Label>
          <Input
            id="password"
            type="password"
            placeholder="мінімум 8 символів"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Підтвердіть пароль</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Змінити пароль
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">📚 ULIT</h1>
          <h2 className="mt-4 text-xl font-semibold text-gray-700">Новий пароль</h2>
        </div>

        <Suspense>
          <ResetPasswordContent />
        </Suspense>

        <p className="text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Повернутись до входу
          </Link>
        </p>
      </div>
    </div>
  );
}
