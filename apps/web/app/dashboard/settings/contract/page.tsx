"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FileText } from "lucide-react";
import { useApi } from "../../../../hooks/useApi";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { IdentityDocsUploader } from "../../../../components/dashboard/IdentityDocsUploader";
import { ContractText, contractTextPlain, signatureBlockPlain } from "../../../../components/legal/ContractText";
import { buildContractDocxBlob } from "../../../../lib/contractDocx";

interface UserContract {
  contractAcceptedAt: string | null;
  taxId: string | null;
  bankIban: string | null;
  payoutDocument: string | null;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
}

// Same structured ПІБ Налаштування профілю collects (and this page's own
// "Змінити договір" form edits) -- falls back to the free-text display name
// only for accounts that haven't filled it in yet.
function buildAuthorName(user: UserContract | null, fallback: string) {
  if (user?.lastName || user?.firstName) {
    return [user.lastName, user.firstName, user.patronymic].filter(Boolean).join(" ");
  }
  return fallback;
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export default function ContractPage() {
  const { data: session } = useSession();
  const { apiFetch, apiUpload, token } = useApi();
  const [user, setUser] = useState<UserContract | null>(null);
  const [loading, setLoading] = useState(true);

  // sign form (not yet signed)
  const [taxId, setTaxId] = useState("");
  const [payoutDocument, setPayoutDocument] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeRights, setAgreeRights] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // "Змінити договір" form (already signed)
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [citizenship, setCitizenship] = useState("Україна");
  const [changeReason, setChangeReason] = useState("Заміна паспорта");
  const [passportSeries, setPassportSeries] = useState("");
  const [registrationAddress, setRegistrationAddress] = useState("");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [agreeChange, setAgreeChange] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSaved, setChangeSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ user: UserContract }>("/api/users/me")
      .then(({ user }) => {
        setUser(user);
        setTaxId(user.taxId ?? "");
        setPayoutDocument(user.payoutDocument ?? "");
        setBankIban(user.bankIban ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function downloadContract() {
    setDownloading(true);
    try {
      const authorName = buildAuthorName(user, session?.user?.name ?? "Автор");
      const text =
        contractTextPlain("—", authorName) +
        signatureBlockPlain({
          authorName,
          taxId: user?.taxId ?? undefined,
          payoutDocument: user?.payoutDocument ?? undefined,
          bankIban: user?.bankIban ?? undefined,
        });
      const blob = await buildContractDocxBlob(text);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dogovir-avtora.docx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSign() {
    setSigning(true);
    setSignError(null);
    try {
      const { user: updated } = await apiFetch<{ user: UserContract }>("/api/users/me/contract/sign", {
        method: "POST",
        body: JSON.stringify({ taxId, payoutDocument, bankIban }),
      });
      setUser((u) => (u ? { ...u, ...updated } : updated));
    } catch (e: any) {
      setSignError(e.message || "Помилка підписання");
    } finally {
      setSigning(false);
    }
  }

  async function handleChangeSubmit() {
    setChanging(true);
    setChangeError(null);
    setChangeSaved(false);
    try {
      const form = new FormData();
      form.append("firstName", firstName);
      form.append("lastName", lastName);
      if (patronymic) form.append("patronymic", patronymic);
      form.append("birthDate", birthDate);
      form.append("citizenship", citizenship);
      form.append("changeReason", changeReason);
      form.append("passportSeries", passportSeries);
      form.append("registrationAddress", registrationAddress);
      docFiles.forEach((file) => form.append("files", file, file.name));

      await apiUpload("/api/users/me/contract", form, "PATCH");
      setChangeSaved(true);
      setShowChangeForm(false);
      setDocFiles([]);
    } catch (e: any) {
      setChangeError(e.message || "Помилка збереження");
    } finally {
      setChanging(false);
    }
  }

  if (loading) {
    return <div className="p-8 animate-pulse text-gray-400">Завантаження…</div>;
  }
  if (!user) return null;

  const payoutFilled = taxId.trim() && payoutDocument.trim() && bankIban.trim();
  const signed = !!user.contractAcceptedAt;
  const changeFormValid =
    agreeChange &&
    firstName.trim() &&
    lastName.trim() &&
    birthDate &&
    passportSeries.trim() &&
    registrationAddress.trim();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Договір на публікацію</h1>
            <p className="text-sm text-gray-500">
              Публічна оферта про надання послуг платформи самовидавництва ULIT
            </p>
          </div>
        </div>

        {signed ? (
          <>
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3 text-center">
              <h2 className="text-xl font-bold text-gray-900">Договір укладено</h2>
              <p className="text-sm text-gray-700">
                Умови договору прийняті та поширюються на всі ваші книги.
                <br />
                Вам не потрібно укладати новий договір для кожної наступної книги.
              </p>
              <p className="text-sm text-gray-500">
                Дата ухвалення умов {fmtDate(user.contractAcceptedAt!)}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowChangeForm((v) => !v)}>
                  Змінити договір
                </Button>
                <Button onClick={downloadContract} loading={downloading}>
                  Завантажити договір
                </Button>
              </div>
            </div>

            {changeSaved && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                ✓ Дані оновлено, дякуємо. Адміністратор перевірить надані документи.
              </div>
            )}

            {showChangeForm && (
              <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Зміна договору</h3>
                  <p className="text-sm text-gray-500">Щоб змінити договір, заповніть усі поля</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">
                      Прізвище <span className="text-red-500">*</span>
                    </Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">
                      Ім&rsquo;я <span className="text-red-500">*</span>
                    </Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="patronymic">По батькові</Label>
                    <Input id="patronymic" value={patronymic} onChange={(e) => setPatronymic(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate">
                      Дата народження <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="citizenship">Громадянство</Label>
                    <select
                      id="citizenship"
                      value={citizenship}
                      onChange={(e) => setCitizenship(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option>Україна</option>
                      <option>Інше</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="changeReason">Причина зміни договору</Label>
                  <select
                    id="changeReason"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option>Заміна паспорта</option>
                    <option>Зміна ПІБ</option>
                    <option>Зміна адреси реєстрації</option>
                    <option>Інше</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="passportSeries">
                    Серія та номер паспорта <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="passportSeries"
                    value={passportSeries}
                    onChange={(e) => setPassportSeries(e.target.value)}
                    placeholder="XX 000000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="registrationAddress">
                    Адреса реєстрації <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    id="registrationAddress"
                    value={registrationAddress}
                    onChange={(e) => setRegistrationAddress(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Файли</Label>
                  <p className="text-xs text-gray-500">
                    Щоб змінити договір, завантажте скани або фото сторінок документа, що засвідчує особу:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-gray-500 space-y-0.5">
                    <li>Фотографію розвороту першої сторінки нового паспорта</li>
                    <li>Фотографію сторінки з пропискою</li>
                  </ul>
                  <IdentityDocsUploader files={docFiles} onChange={setDocFiles} />
                </div>

                <label className="flex items-start gap-2.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreeChange}
                    onChange={(e) => setAgreeChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  Я згоден з умовами договору та політикою обробки персональних даних
                </label>

                {changeError && <p className="text-sm text-red-600">{changeError}</p>}

                <Button onClick={handleChangeSubmit} loading={changing} disabled={!changeFormValid}>
                  Змінити дані
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={downloadContract} loading={downloading}>
                ⬇ Завантажити договір (Word)
              </Button>
              <span className="text-xs text-gray-400">Договір діє на всі ваші книги на платформі</span>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <ContractText />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Платіжні реквізити</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Потрібні для виплати роялті — Платформа є податковим агентом (п. 4.4 договору).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  ІПН / РНОКПП <span className="text-red-500">*</span>
                  <input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="1234567890"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  IBAN для виплат <span className="text-red-500">*</span>
                  <input
                    value={bankIban}
                    onChange={(e) => setBankIban(e.target.value)}
                    placeholder="UA00 0000 0000 0000 0000 0000 0"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </label>
                <label className="text-sm text-gray-700 sm:col-span-2">
                  Паспортні дані або дані ФОП <span className="text-red-500">*</span>
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
                Я підтверджую, що володію авторськими правами на твори, які публікуватиму на платформі
              </label>

              {signError && <p className="text-sm text-red-600">{signError}</p>}

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
