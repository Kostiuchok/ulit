"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { AvatarUploader } from "../../../components/dashboard/AvatarUploader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useApi } from "../../../hooks/useApi";

const UK_TRANSLIT: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",
  и:"y",і:"i",ї:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",
  р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",
  щ:"shch",ь:"",ю:"iu",я:"ia",ъ:"",ы:"y",э:"e",ё:"yo",
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((ch) => UK_TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

const profileSchema = z.object({
  name: z.string().min(2, "Ім'я повинно містити мінімум 2 символи"),
  slug: z
    .string()
    .min(2, "Slug мінімум 2 символи")
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Тільки малі літери, цифри та дефіс"),
  bio: z.string().max(1000, "Максимум 1000 символів").optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  slug: string;
  bio?: string | null;
  avatarUrl?: string | null;
  role: string;
  _count?: { books: number };
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { apiFetch, token } = useApi();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  const [slugTouched, setSlugTouched] = useState(false);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const watchedName = watch("name");
  useEffect(() => {
    if (!slugTouched && watchedName && watchedName !== loadedName) {
      setValue("slug", toSlug(watchedName), { shouldValidate: true });
    }
  }, [watchedName, slugTouched, loadedName]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ user: UserProfile }>("/api/users/me")
      .then(({ user }) => {
        setProfile(user);
        setLoadedName(user.name);
        reset({ name: user.name, slug: user.slug, bio: user.bio ?? "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const onSubmit = async (data: ProfileForm) => {
    setServerError("");
    setSaved(false);
    try {
      const { user } = await apiFetch<{ user: UserProfile }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setProfile(user);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setServerError(e.message || "Помилка збереження");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Налаштування профілю</h1>
          <p className="mt-1 text-sm text-gray-500">{session?.user?.email}</p>
        </div>

        {/* Avatar */}
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Фото профілю</h2>
          <AvatarUploader
            currentAvatarUrl={profile?.avatarUrl}
            onSuccess={(url) => setProfile((p) => p ? { ...p, avatarUrl: url } : p)}
          />
        </div>

        {/* Profile form */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-5">Особисті дані</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Ім'я автора</Label>
              <Input id="name" {...register("name")} placeholder="Іван Франко" />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Публічний slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">knyha.ua/authors/</span>
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder="ivan-franko"
                  className="flex-1"
                  onChange={(e) => { setSlugTouched(true); register("slug").onChange(e); }}
                />
              </div>
              {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Біографія</Label>
              <textarea
                id="bio"
                {...register("bio")}
                placeholder="Кілька слів про себе…"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              {errors.bio && <p className="text-sm text-red-500">{errors.bio.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
            )}
            {saved && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                ✓ Профіль збережено
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" loading={isSubmitting}>
                Зберегти зміни
              </Button>
              {profile && (
                <p className="text-xs text-gray-400">
                  {profile._count?.books ?? 0} книг опубліковано
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
