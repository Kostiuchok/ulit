"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "../../hooks/useApi";

// Publisher-level (ULIT itself, not per-book) documents needed to register
// for a block of ISBN numbers and to submit УДК requests to Книжкова палата
// (docs/instr_isbn.pdf §2.1, ukrbook.net/UDC_poslugy.html) -- fixed set,
// mirrors PUBLISHER_DOCUMENT_KEYS in apps/api/src/modules/admin/
// publisher-documents.ts. "Копія Статуту видавця" (§2.1.3) deliberately
// left out -- only applies to publishers NOT in the Державний реєстр, which
// doesn't fit ULIT's own registration.
const PUBLISHER_DOCUMENTS = [
  {
    key: "guarantee_letter",
    label: "Гарантійний лист видавця",
    hint: "На бланку видавця: юридична адреса, телефони/факс, адреса для листування, e-mail, сайт (за наявності). Потрібен і для блоку ISBN, і для заявки на УДК.",
  },
  {
    key: "registry_certificate",
    label: "Свідоцтво про внесення до Державного реєстру видавців",
    hint: "Завірена копія, з позначкою «видавнича діяльність» у графі видів діяльності.",
  },
  {
    key: "vat_certificate",
    label: "Свідоцтво платника ПДВ",
    hint: "Копія — окрема вимога саме для заявки на УДК.",
  },
  {
    key: "annual_output_letter",
    label: "Лист про заплановані обсяги видань",
    hint: "Кількість видань за минулий рік і запланованих на наступний — на основі цього Книжкова палата розраховує новий блок номерів ISBN.",
  },
] as const;

interface DocumentState {
  key: string;
  url: string | null;
  uploadedAt: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uk-UA");
}

export function PublisherDocumentsCard() {
  const { apiFetch, apiUpload, token } = useApi();
  const [documents, setDocuments] = useState<Record<string, DocumentState>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!token) return;
    apiFetch<{ documents: DocumentState[] }>("/api/admin/publisher-documents")
      .then((d) => setDocuments(Object.fromEntries(d.documents.map((doc) => [doc.key, doc]))))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleFile(key: string, file: File) {
    setError("");
    setUploadingKey(key);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await apiUpload<DocumentState>(`/api/admin/publisher-documents/${key}`, form);
      setDocuments((prev) => ({ ...prev, [key]: updated }));
    } catch (e: any) {
      setError(e.message || "Не вдалося завантажити файл");
    } finally {
      setUploadingKey(null);
    }
  }

  const allReady = PUBLISHER_DOCUMENTS.every((doc) => !!documents[doc.key]?.url);
  const readyCount = PUBLISHER_DOCUMENTS.filter((doc) => !!documents[doc.key]?.url).length;

  return (
    <div className="rounded-xl border bg-white shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Документи видавця (для ISBN + УДК)</h2>
        <p className="text-xs text-gray-500 mt-1">
          Разові/періодичні документи ULIT як видавця — потрібні для отримання блоку номерів ISBN і для кожної
          заявки на УДК до Книжкової палати. Не прив&apos;язані до конкретної книги.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 animate-pulse">Завантаження…</p>
      ) : (
        <>
          <ul className="divide-y">
            {PUBLISHER_DOCUMENTS.map((doc) => {
              const state = documents[doc.key];
              const ready = !!state?.url;
              return (
                <li key={doc.key} className="flex items-start gap-3 py-3">
                  <span className={`mt-0.5 shrink-0 ${ready ? "text-green-600" : "text-amber-500"}`}>
                    {ready ? "✓" : "○"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{doc.hint}</p>
                    {ready && state?.uploadedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Завантажено {fmtDate(state.uploadedAt)} ·{" "}
                        <a href={state.url!} target="_blank" rel="noreferrer" className="underline hover:no-underline">
                          переглянути
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <input
                      ref={(el) => { inputRefs.current[doc.key] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) handleFile(doc.key, file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingKey === doc.key}
                      onClick={() => inputRefs.current[doc.key]?.click()}
                      className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {uploadingKey === doc.key ? "Завантаження…" : ready ? "Замінити" : "Завантажити"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div
            className={`rounded-md p-3 text-sm ${
              allReady ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {allReady
              ? "✓ Усі документи готові до відправки"
              : `Бракує ${PUBLISHER_DOCUMENTS.length - readyCount} з ${PUBLISHER_DOCUMENTS.length} документів`}
          </div>

          <p className="text-xs text-gray-400 border-t pt-2">Відправка поштою з цієї сторінки — у розробці.</p>
        </>
      )}
    </div>
  );
}
