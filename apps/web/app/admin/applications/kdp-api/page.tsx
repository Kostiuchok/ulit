export const metadata = { title: "KDP Selling Partner API" };

export default function KdpApiPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Amazon KDP Selling Partner API</h1>
        <p className="text-sm text-gray-500 mt-1">Заявка на отримання доступу до API автоматизації KDP</p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Кроки для отримання доступу</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Зареєструйтесь як Amazon Selling Partner: <code className="bg-gray-100 px-1 rounded">sellercentral.amazon.com</code></li>
            <li>Перейдіть у Apps &amp; Services → Develop Apps</li>
            <li>Натисніть «Register new application»</li>
            <li>Заповніть форму: тип — «Publishing», категорія — «Book content delivery»</li>
            <li>Вкажіть OAuth redirect URL: <code className="bg-gray-100 px-1 rounded">https://knyha.ua/api/integrations/kdp/callback</code></li>
            <li>Надішліть заявку на Amazon review (2–4 тижні)</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Необхідні дані</h2>
          <div className="space-y-3">
            {[
              { label: "Application name", value: "Knyha Publishing Platform" },
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
      </div>
    </div>
  );
}
