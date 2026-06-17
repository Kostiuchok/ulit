export const metadata = { title: "Google Books Partner API" };

export default function GoogleBooksPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Books Partner Program</h1>
        <p className="text-sm text-gray-500 mt-1">Заявка на партнерський доступ до Google Play Books</p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Порядок подачі заявки</h2>
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
          <h2 className="text-base font-semibold text-gray-900 mb-2">Шаблон листа</h2>
          <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
{`Subject: Google Books Partner Application — Knyha Platform

Dear Google Books Partnership Team,

We are Knyha (knyha.ua), a Ukrainian self-publishing platform
helping Ukrainian authors distribute their books globally.

We would like to apply for Google Play Books Partner access to
automatically deliver EPUB files on behalf of our authors.

Platform stats:
- Authors registered: [N]
- Published books: [N]
- File formats: EPUB 3, PDF, FB2, MOBI

Technical contact: admin@knyha.ua
Company: [Company name], Ukraine

Best regards,
Knyha Team`}
          </div>
        </section>

        <section className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-1">📌 Статус: Не подано</p>
          <p>Після схвалення отримаєте FTP/SFTP доступ або API credentials для завантаження книг.</p>
        </section>
      </div>
    </div>
  );
}
