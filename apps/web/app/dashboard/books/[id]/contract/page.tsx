"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText } from "lucide-react";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { ContractText, contractTextPlain } from "@/components/legal/ContractText";

interface ContractBook {
  title: string;
  publicationTimeline?: Record<string, string> | null;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export default function BookContractPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { apiFetch } = useApi();
  const { book, setBook, loading } = useBook<ContractBook>(id);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeRights, setAgreeRights] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadContract() {
    const text = contractTextPlain(book?.title ?? "", session?.user?.name ?? "Автор");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dogovir-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSign() {
    setSigning(true);
    setError(null);
    try {
      const { book: updated } = await apiFetch<{ book: { publicationTimeline: Record<string, string> } }>(
        `/api/books/${id}/contract/sign`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setBook((b) => (b ? { ...b, publicationTimeline: updated.publicationTimeline } : b));
    } catch (e: any) {
      setError(e.message || "Помилка підписання");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return <div className="p-8 animate-pulse text-gray-400">Завантаження…</div>;
  }
  if (!book) return null;

  const reviewDone = !!book.publicationTimeline?.review_done;
  const signedAt = book.publicationTimeline?.contract_pending;

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <Link href={`/dashboard/books/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {book.title}
        </Link>

        <div className="mt-4 mb-8 flex items-center gap-3">
          <FileText className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Договір — «{book.title}»</h1>
            <p className="text-sm text-gray-500">Публічна оферта про надання послуг платформи самовидавництва Knyha</p>
          </div>
        </div>

        {!reviewDone ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Договір стане доступним після того, як адміністратор завершить перевірку книги.
          </div>
        ) : signedAt ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-1">
            <p className="font-semibold text-green-800">✓ Договір підписано</p>
            <p className="text-sm text-green-700">Дата підписання: {fmt(signedAt)}</p>
            <p className="text-xs text-green-600">
              Адміністратор відправить книгу на публікацію після фінальної перевірки документів.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={downloadContract}>
                ⬇ Завантажити договір
              </Button>
              <span className="text-xs text-gray-400">Шаблон договору для книги «{book.title}»</span>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <ContractText />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <label className="flex items-start gap-2.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                Я ознайомився(-лась) з умовами договору та погоджуюсь з ними
              </label>
              <label className="flex items-start gap-2.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={agreeRights}
                  onChange={(e) => setAgreeRights(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                Я підтверджую, що володію авторськими правами на твір «{book.title}»
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                onClick={handleSign}
                loading={signing}
                disabled={!agreeTerms || !agreeRights}
                className="w-full sm:w-auto"
              >
                Підписати договір
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
