"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

const forgotPasswordSchema = z.object({
  email: z.string().email("Введіть коректний email"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordForm) => {
    await fetch("/api/users/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email }),
    });
    // Always show the same success state, whether or not the email exists —
    // avoids leaking which addresses are registered.
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">📚 ULIT</h1>
          <h2 className="mt-4 text-xl font-semibold text-gray-700">Скидання пароля</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-8">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="text-5xl mb-2">📧</div>
              <p className="text-gray-700">
                Якщо такий email зареєстровано, ми надіслали на нього лист з посиланням для скидання пароля.
              </p>
              <p className="text-sm text-gray-500">Перевірте поштову скриньку (і папку «Спам»).</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <p className="text-sm text-gray-600">
                Введіть email, з яким ви реєструвались — ми надішлемо посилання для скидання пароля.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Надіслати посилання
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Повернутись до входу
          </Link>
        </p>
      </div>
    </div>
  );
}
