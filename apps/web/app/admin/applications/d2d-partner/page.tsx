export const metadata = { title: "D2D Partner Program" };

export default function D2dPartnerPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Draft2Digital Partner Program</h1>
        <p className="text-sm text-gray-500 mt-1">Лист до D2D Business Development для агрегаторського доступу</p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Контакти D2D</h2>
          <div className="space-y-2 text-sm">
            <p>Email: <a href="mailto:support@draft2digital.com" className="text-blue-600 hover:underline">support@draft2digital.com</a></p>
            <p>Business Dev: <a href="mailto:partnerships@draft2digital.com" className="text-blue-600 hover:underline">partnerships@draft2digital.com</a></p>
            <p>Сайт: <a href="https://www.draft2digital.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">draft2digital.com</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Шаблон листа</h2>
          <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
{`Subject: Publisher/Aggregator Account Request — Knyha Platform (Ukraine)

Dear D2D Business Development Team,

My name is [Name], and I represent Knyha (knyha.ua) — a Ukrainian
self-publishing platform dedicated to helping Ukrainian authors
distribute their books globally.

We are requesting a Publisher/Aggregator account to submit books
on behalf of our registered authors.

About our platform:
- Ukrainian-language self-publishing service
- Authors upload DOCX, we generate EPUB 3, MOBI, PDF
- ISBN assigned through Ukrainian national registry
- Currently: [N] published books, [N] authors

Our technical capabilities:
- EPUB 3 compliant files
- Proper metadata (title, author, genre, ISBN, description)
- Cover images at 1800×2700px (300 DPI)
- Royalty tracking per author

We would like to integrate with D2D API to automate book submission.

Best regards,
[Name]
Knyha Platform — knyha.ua
Email: admin@knyha.ua`}
          </div>
        </section>

        <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold mb-1">📌 Статус: Не відправлено</p>
          <p>D2D зазвичай відповідає протягом 1–2 тижнів. Після схвалення отримаєте API ключ для автоматичної відправки.</p>
        </section>
      </div>
    </div>
  );
}
