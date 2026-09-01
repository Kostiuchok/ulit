"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";

// A 401 here means the SERVER rejected the token itself (missing or an
// invalid signature) -- not "you don't have permission" (that's 403).
// Before this, any 401 just threw straight away and stayed that way until
// the author noticed and manually reloaded/re-logged in -- during that
// window every autosave attempt (every ~2s of editing) kept silently
// failing with no automatic recovery. Sessions here are already generous
// (30-day cookie, API tokens with no expiry of their own), so a genuine
// permanent failure should be rare; most of what actually trips this is a
// stale token value sitting in this tab's already-rendered session state
// not matching what NextAuth's own session cookie currently holds (e.g.
// after the tab sat backgrounded a while, or briefly during a deploy).
// `update()` forces NextAuth to re-read the real session and hands back
// its current value directly (not just next render's props), so retrying
// with THAT recovers the common case with no author action at all. If the
// token is genuinely bad, the retry fails the same way and the caller's
// existing error handling (e.g. ManuscriptEditor's "⚠ Повторити") still
// applies -- this only removes the silent-forever-failure case, it doesn't
// add any new interruption.
async function withTokenRetry<T>(
  attempt: (token: string | undefined) => Promise<Response>,
  token: string | undefined,
  update: ReturnType<typeof useSession>["update"]
): Promise<Response> {
  const res = await attempt(token);
  if (res.status !== 401 || !token) return res;
  const refreshed = await update().catch(() => null);
  const freshToken = (refreshed?.user as any)?.apiToken as string | undefined;
  if (!freshToken || freshToken === token) return res;
  return attempt(freshToken);
}

async function parseErrorResponse(res: Response, fallback: string): Promise<Error & { code?: string }> {
  const body = await res.json().catch(() => ({}));
  const err = new Error(body.error || fallback) as Error & { code?: string };
  err.code = body.code;
  return err;
}

export function useApi() {
  const { data: session, update } = useSession();
  const token = (session?.user as any)?.apiToken as string | undefined;

  const apiFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const hasBody = init?.body != null;
      const res = await withTokenRetry(
        (authToken) =>
          fetch(path, {
            cache: "no-store",
            ...init,
            headers: {
              ...(hasBody ? { "Content-Type": "application/json" } : {}),
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              ...(init?.headers ?? {}),
            },
          }),
        token,
        update
      );
      if (!res.ok) throw await parseErrorResponse(res, `Request failed: ${res.status}`);
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
    [token, update]
  );

  const apiUpload = useCallback(
    async <T,>(path: string, formData: FormData, method: "POST" | "PATCH" = "POST"): Promise<T> => {
      const res = await withTokenRetry(
        (authToken) =>
          fetch(path, {
            method,
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            body: formData,
          }),
        token,
        update
      );
      if (!res.ok) throw await parseErrorResponse(res, `Upload failed: ${res.status}`);
      return res.json() as Promise<T>;
    },
    [token, update]
  );

  return { apiFetch, apiUpload, token };
}
