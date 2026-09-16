"use client";

import { Card } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
        <p className="text-sm text-gray-500 mt-1">Заявки на партнерський/API доступ до зовнішніх сервісів дистрибуції</p>
      </div>

      <Tabs defaultValue="kdp">
        <TabsList>
          <TabsTrigger value="kdp">KDP API</TabsTrigger>
          <TabsTrigger value="google">Google Books</TabsTrigger>
          <TabsTrigger value="d2d">D2D Partner</TabsTrigger>
        </TabsList>

        <TabsContent value="kdp">
          <Card className="p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Amazon KDP Selling Partner API</h2>
              <p className="text-sm text-gray-500 mt-0.5">Заявка на отримання доступу до API автоматизації KDP</p>
            </div>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Кроки для отримання доступу</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Зареєструйтесь як Amazon Selling Partner: <code className="bg-gray-100 px-1 rounded">sellercentral.amazon.com</code></li>
                <li>Перейдіть у Apps &amp; Services → Develop Apps</li>
                <li>Натисніть «Register new application»</li>
                <li>Заповніть форму: тип — «Publishing», категорія — «Book content delivery»</li>
                <li>Вкажіть OAuth redirect URL: <code className="bg-gray-100 px-1 rounded">https://ulit.ua/api/integrations/kdp/callback</code></li>
                <li>Надішліть заявку на Amazon review (2–4 тижні)</li>
              </ol>
            </section>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Необхідні дані</h3>
              <div className="space-y-3">
                {[
                  { label: "Application name", value: "ULIT Publishing Platform" },
                  { label: "Application description", value: "Ukrainian self-publishing platform. Automates EPUB delivery to KDP for Ukrainian authors." },
                  { label: "Business type", value: "Publisher / Aggregator" },
                  { label: "Marketplace", value: "Amazon.com, Amazon.co.uk" },
                  { label: "Required scopes", value: "Publishing API: Submit, List, Pricing" },
                ].map((f) => (
                  <div key={f.label} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm text-gray-900 mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">📌 Статус: Не подано</p>
              <p>Після отримання <code>LWA_APP_ID</code> та <code>LWA_CLIENT_SECRET</code> — додайте їх у змінні середовища API.</p>
            </section>
          </Card>
        </TabsContent>

        <TabsContent value="google">
          <Card className="p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Google Books Partner Program</h2>
              <p className="text-sm text-gray-500 mt-0.5">Заявка на партнерський доступ до Google Play Books</p>
            </div>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Порядок подачі заявки</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Перейдіть на <code className="bg-gray-100 px-1 rounded">play.google.com/books/publish</code></li>
                <li>Натисніть «Стати партнером» → заповніть форму видавця</li>
                <li>Вкажіть тип: «Publisher» або «Aggregator»</li>
                <li>Завантажте скан реєстраційних документів компанії (ФОП або ТОВ)</li>
                <li>Вкажіть кількість книг на старті: 10+</li>
                <li>Google розглядає 3–6 тижнів</li>
              </ol>
            </section>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Шаблон листа</h3>
              <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
{`Subject: Google Books Partner Application — ULIT Platform

Dear Google Books Partnership Team,

We are ULIT (ulit.ua), a Ukrainian self-publishing platform
helping Ukrainian authors distribute their books globally.

We would like to apply for Google Play Books Partner access to
automatically deliver EPUB files on behalf of our authors.

Platform stats:
- Authors registered: [N]
- Published books: [N]
- File formats: EPUB 3, PDF, FB2, MOBI

Technical contact: admin@ulit.ua
Company: [Company name], Ukraine

Best regards,
ULIT Team`}
              </div>
            </section>

            <section className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              <p className="font-semibold mb-1">📌 Статус: Не подано</p>
              <p>Після схвалення отримаєте FTP/SFTP доступ або API credentials для завантаження книг.</p>
            </section>
          </Card>
        </TabsContent>

        <TabsContent value="d2d">
          <Card className="p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Draft2Digital Partner Program</h2>
              <p className="text-sm text-gray-500 mt-0.5">Лист до D2D Business Development для агрегаторського доступу</p>
            </div>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Контакти D2D</h3>
              <div className="space-y-2 text-sm">
                <p>Email: <a href="mailto:support@draft2digital.com" className="text-blue-600 hover:underline">support@draft2digital.com</a></p>
                <p>Business Dev: <a href="mailto:partnerships@draft2digital.com" className="text-blue-600 hover:underline">partnerships@draft2digital.com</a></p>
                <p>Сайт: <a href="https://www.draft2digital.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">draft2digital.com</a></p>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Шаблон листа</h3>
              <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
{`Subject: Publisher/Aggregator Account Request — ULIT Platform (Ukraine)

Dear D2D Business Development Team,

My name is [Name], and I represent ULIT (ulit.ua) — a Ukrainian
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
ULIT Platform — ulit.ua
Email: admin@ulit.ua`}
              </div>
            </section>

            <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold mb-1">📌 Статус: Не відправлено</p>
              <p>D2D зазвичай відповідає протягом 1–2 тижнів. Після схвалення отримаєте API ключ для автоматичної відправки.</p>
            </section>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
