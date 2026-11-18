import type { Metadata } from "next";
import { AcceptBar } from "../../../components/legal/AcceptBar";
import { AGREEMENT_EDITION, AGREEMENT_SUBTITLE, ContractText } from "../../../components/legal/ContractText";

export const metadata: Metadata = {
  title: "Договір автора | ULIT",
  description: "Публічна оферта платформи ULIT — умови публікації та продажу книг для авторів.",
};

export default function AuthorAgreementPage() {

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Договір з автором</h1>
          <p className="text-sm text-gray-500">{AGREEMENT_SUBTITLE}</p>
          <p className="text-sm text-gray-400 mt-1">Редакція від {AGREEMENT_EDITION}</p>
        </div>

        <ContractText />
      </div>

      <AcceptBar />
    </div>
  );
}
