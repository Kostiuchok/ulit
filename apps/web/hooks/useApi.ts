"use client";

import { useSession } from "next-auth/react";

export function useApi() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.apiToken as string | undefined;

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const hasBody = init?.body != null;
    const res = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `Request failed: ${res.status}`) as Error & { code?: string };
      err.code = body.code;
      throw err;
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async function apiUpload<T>(path: string, formData: FormData, method: "POST" | "PATCH" = "POST"): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `Upload failed: ${res.status}`) as Error & { code?: string };
      err.code = body.code;
      throw err;
    }
    return res.json() as Promise<T>;
  }

  return { apiFetch, apiUpload, token };
}
