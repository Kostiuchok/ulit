"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText } from "lucide-react";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { ContractText, ContractAddendum, contractTextPlain, signatureBlockPlain } from "@/components/legal/ContractText";
import { buildContractDocxBlob } from "@/lib/contractDocx";

interface ContractBook {
  title: string;
  publicationTimeline?: Record<string, string> | null;
  distributionChannels?: string[] | null;
  distributionStrategy?: string;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export default function BookContractPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { apiFetch } = useApi();
  const { book, setBook, loading } = useBook<ContractBook>(id);
  const [taxId, setTaxId] = useState("");
  const [payoutDocument, setPayoutDocument] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeRights, setAgreeRights] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channels = book?.distributionChannels ?? [];
  const strategy = book?.distributionStrategy;

  async function downloadContract() {
    setDownloading(true);
    try {
      const authorName = session?.user?.name ?? "Автор";
      const text =
        contractTextPlain(book?.title ?? "", authorName, { channels, strategy }) +
        signatureBlockPlain({ authorName, taxId, payoutDocument, bankIban });
      const blob = await buildContractDocxBlob(text);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dogovir-${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSign() {
    setSigning(true);
    setError(null);
    try {
      const { book: updated } = await apiFetch<{ book: { publicationTimeline: Record<string, string> } }>(
        `/api/books/${id}/contract/sign`,
        { method: "POST", body: JSON.stringify({ taxId, payoutDocument, bankIban }) }
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
  const payoutFilled = taxId.trim() && payoutDocument.trim() && bankIban.trim();

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <Link href={`/dashboard/books/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {book.title}
        </Link>

        <div className="mt-4 mb-6 flex items-center gap-3">
          <FileText className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Договір — «{book.title}»</h1>
            <p className="text-sm text-gray-500">Публічна оферта про надання послуг платформи самовидавництва Knyha</p>
          </div>
        </div>

        <div className="mb-6">
          <ContractAddendum channels={channels} strategy={strategy} />
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
              Адміністратор перевірить надані платіжні реквізити та відправить книгу на публікацію.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={downloadContract} loading={downloading}>
                ⬇ Завантажити договір (Word)
              </Button>
              <span className="text-xs text-gray-400">Шаблон договору для книги «{book.title}»</span>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <ContractText />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Платіжні реквізити</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Потрібні для виплати роялті — Платформа є податковим агентом (п. 4.4 договору).
                  Адміністратор перевірить ці дані перед укладенням договору («Повторна перевірка документів»).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  ІПН / РНОКПП
                  <input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="1234567890"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  IBAN для виплат
                  <input
                    value={bankIban}
                    onChange={(e) => setBankIban(e.target.value)}
                    placeholder="UA00 0000 0000 0000 0000 0000 0"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </label>
                <label className="text-sm text-gray-700 sm:col-span-2">
                  Паспортні дані або дані ФОП
                  <input
                    value={payoutDocument}
                    onChange={(e) => setPayoutDocument(e.target.value)}
                    placeholder="Серія, номер, ким виданий — або реквізити ФОП"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </label>
              </div>
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
                disabled={!agreeTerms || !agreeRights || !payoutFilled}
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
