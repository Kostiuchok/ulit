"use client";

import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useApi() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.apiToken as string | undefined;

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  return { apiFetch, apiUpload, token };
}
