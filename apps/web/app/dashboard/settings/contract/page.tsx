"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FileText } from "lucide-react";
import { useApi } from "../../../../hooks/useApi";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
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
  birthDate: string | null;
  citizenship: string | null;
  passportSeries: string | null;
  registrationAddress: string | null;
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
  const [payoutSaved, setPayoutSaved] = useState(false);

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
          birthDate: user?.birthDate ?? undefined,
          citizenship: user?.citizenship ?? undefined,
          passportSeries: user?.passportSeries ?? undefined,
          registrationAddress: user?.registrationAddress ?? undefined,
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
    setPayoutSaved(false);
    try {
      const { user: updated } = await apiFetch<{ user: UserContract }>("/api/users/me/contract/sign", {
        method: "POST",
        body: JSON.stringify({ taxId, payoutDocument, bankIban }),
      });
      setUser((u) => (u ? { ...u, ...updated } : updated));
      setPayoutSaved(true);
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
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 animate-pulse text-center text-gray-400">
        Завантаження…
      </div>
    );
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
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-6">
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

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Платіжні реквізити</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Використовуються для виплати роялті та потрапляють у текст договору (п. 4.4). Можна оновити
                  в будь-який час.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="taxId">
                    ІПН / РНОКПП <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="taxId"
                    value={taxId}
                    onChange={(e) => { setTaxId(e.target.value); setPayoutSaved(false); }}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankIban">
                    IBAN для виплат <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bankIban"
                    value={bankIban}
                    onChange={(e) => { setBankIban(e.target.value); setPayoutSaved(false); }}
                    placeholder="UA00 0000 0000 0000 0000 0000 0"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="payoutDocument">
                    Паспортні дані або дані ФОП <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="payoutDocument"
                    value={payoutDocument}
                    onChange={(e) => { setPayoutDocument(e.target.value); setPayoutSaved(false); }}
                    placeholder="Серія, номер, ким виданий — або реквізити ФОП"
                  />
                </div>
              </div>

              {signError && <p className="text-sm text-red-600">{signError}</p>}
              {payoutSaved && !signError && (
                <p className="text-sm text-green-700">✓ Реквізити збережено</p>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleSign}
                loading={signing}
                disabled={!payoutFilled}
              >
                Зберегти реквізити
              </Button>
            </div>

            {changeSaved && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                ✓ Дані оновлено, дякуємо. Адміністратор перевірить надані документи.
              </div>
            )}

            {showChangeForm && (
              <Card className="shadow-sm">
              <CardContent className="space-y-5 p-6">
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
                    <Select value={citizenship} onValueChange={setCitizenship}>
                      <SelectTrigger id="citizenship">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Україна">Україна</SelectItem>
                        <SelectItem value="Інше">Інше</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="changeReason">Причина зміни договору</Label>
                  <Select value={changeReason} onValueChange={setChangeReason}>
                    <SelectTrigger id="changeReason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Заміна паспорта">Заміна паспорта</SelectItem>
                      <SelectItem value="Зміна ПІБ">Зміна ПІБ</SelectItem>
                      <SelectItem value="Зміна адреси реєстрації">Зміна адреси реєстрації</SelectItem>
                      <SelectItem value="Інше">Інше</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Textarea
                    id="registrationAddress"
                    value={registrationAddress}
                    onChange={(e) => setRegistrationAddress(e.target.value)}
                    rows={3}
                    className="resize-none"
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

                <Label className="flex items-start gap-2.5 font-normal text-gray-700">
                  <Checkbox
                    checked={agreeChange}
                    onCheckedChange={(v) => setAgreeChange(v === true)}
                    className="mt-0.5"
                  />
                  Я згоден з умовами договору та політикою обробки персональних даних
                </Label>

                {changeError && <p className="text-sm text-red-600">{changeError}</p>}

                <Button onClick={handleChangeSubmit} loading={changing} disabled={!changeFormValid}>
                  Змінити дані
                </Button>
              </CardContent>
              </Card>
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

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <ContractText />
              </CardContent>
            </Card>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Платіжні реквізити</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Потрібні для виплати роялті — Платформа є податковим агентом (п. 4.4 договору).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="taxIdUnsigned">
                    ІПН / РНОКПП <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="taxIdUnsigned"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankIbanUnsigned">
                    IBAN для виплат <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bankIbanUnsigned"
                    value={bankIban}
                    onChange={(e) => setBankIban(e.target.value)}
                    placeholder="UA00 0000 0000 0000 0000 0000 0"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="payoutDocumentUnsigned">
                    Паспортні дані або дані ФОП <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="payoutDocumentUnsigned"
                    value={payoutDocument}
                    onChange={(e) => setPayoutDocument(e.target.value)}
                    placeholder="Серія, номер, ким виданий — або реквізити ФОП"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <Label className="flex items-start gap-2.5 font-normal text-gray-700">
                <Checkbox
                  checked={agreeTerms}
                  onCheckedChange={(v) => setAgreeTerms(v === true)}
                  className="mt-0.5"
                />
                Я ознайомився(-лась) з умовами договору та погоджуюсь з ними
              </Label>
              <Label className="flex items-start gap-2.5 font-normal text-gray-700">
                <Checkbox
                  checked={agreeRights}
                  onCheckedChange={(v) => setAgreeRights(v === true)}
                  className="mt-0.5"
                />
                Я підтверджую, що володію авторськими правами на твори, які публікуватиму на платформі
              </Label>

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
