import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Політика конфіденційності | Knyha",
  description: "Як платформа Knyha збирає, використовує та захищає ваші персональні дані.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Політика конфіденційності</h1>
        <p className="text-sm text-gray-400">Редакція від 01.01.2025</p>
      </div>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Хто ми</h2>
          <p>
            ФОП «Knyha» (далі — «Knyha», «ми», «нам», «наш») — оператор платформи самовидавництва,
            розташованої за адресою <strong>knyha.ua</strong>. Ми є контролером персональних даних
            у розумінні Закону України «Про захист персональних даних» та Регламенту ЄС 2016/679 (GDPR).
          </p>
          <p>Контакт з питань конфіденційності: <a href="mailto:privacy@knyha.ua" className="text-blue-600 hover:underline">privacy@knyha.ua</a></p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Які дані ми збираємо</h2>

          <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">2.1 Дані акаунта</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li>Ім'я та прізвище (або псевдонім)</li>
            <li>Адреса електронної пошти</li>
            <li>Хешований пароль (ми не зберігаємо паролі у відкритому вигляді)</li>
            <li>Аватар (за бажанням)</li>
            <li>Біографія автора (за бажанням)</li>
          </ul>

          <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">2.2 Дані транзакцій</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li>Інформація про замовлення (книги, формати, суми)</li>
            <li>Статус оплати (дані карток ми не зберігаємо — обробляє LiqPay)</li>
            <li>Дані для виплати роялті авторам</li>
          </ul>

          <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">2.3 Технічні дані</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li>IP-адреса (для безпеки та юридичних цілей, зокрема фіксація акцепту договору)</li>
            <li>User-agent браузера</li>
            <li>Файли cookie (детально у розділі 6)</li>
            <li>Технічні журнали (logs) для діагностики помилок</li>
          </ul>

          <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">2.4 Контент авторів</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li>Рукописи та конвертовані файли книг</li>
            <li>Обкладинки книг</li>
            <li>Метадані книг (назва, опис, жанр, ISBN)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Мета обробки даних</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Мета</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Правова підстава</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="px-3 py-2">Надання послуг платформи</td><td className="px-3 py-2">Виконання договору</td></tr>
              <tr><td className="px-3 py-2">Обробка платежів та роялті</td><td className="px-3 py-2">Виконання договору</td></tr>
              <tr><td className="px-3 py-2">Реєстрація акцепту договору автора (IP + час)</td><td className="px-3 py-2">Законний інтерес (юридичний доказ)</td></tr>
              <tr><td className="px-3 py-2">Надсилання сповіщень (Email)</td><td className="px-3 py-2">Виконання договору / згода</td></tr>
              <tr><td className="px-3 py-2">Безпека та боротьба з шахрайством</td><td className="px-3 py-2">Законний інтерес</td></tr>
              <tr><td className="px-3 py-2">Аналітика (анонімна)</td><td className="px-3 py-2">Законний інтерес / згода</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Передача даних третім особам</h2>
          <p>
            Ми не продаємо персональні дані. Передача можлива лише в таких випадках:
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li><strong>LiqPay (Приват24)</strong> — обробка платежів;</li>
            <li><strong>Draft2Digital, Amazon KDP, Google Play Books</strong> — дистрибуція книг за згодою автора;</li>
            <li><strong>Хостинг-провайдер (Hetzner)</strong> — зберігання даних на серверах у Німеччині (ЄС);</li>
            <li><strong>Органи державної влади</strong> — за законними запитами відповідно до законодавства України.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Строки зберігання даних</h2>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li>Дані акаунта — протягом дії акаунта + 1 рік після видалення;</li>
            <li>Дані транзакцій — 5 років (вимоги податкового законодавства);</li>
            <li>IP-адреса акцепту договору — протягом дії договору + 3 роки;</li>
            <li>Технічні журнали — 90 днів.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Файли Cookie</h2>
          <p>Ми використовуємо наступні типи cookie:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li><strong>Обов'язкові</strong> — сесія авторизації (NextAuth.js), захист CSRF;</li>
            <li><strong>Функціональні</strong> — збереження налаштувань читача (тема EPUB);</li>
            <li><strong>Аналітичні</strong> — анонімна статистика відвідуваності (тільки за вашою згодою).</li>
          </ul>
          <p>
            Ви можете керувати налаштуваннями cookie через банер або налаштування браузера.
            Відмова від аналітичних cookie не впливає на функціональність сайту.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Ваші права (GDPR)</h2>
          <p>Відповідно до GDPR та законодавства України ви маєте право:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-4">
            <li><strong>Доступ</strong> — отримати копію ваших персональних даних;</li>
            <li><strong>Виправлення</strong> — виправити неточні дані;</li>
            <li><strong>Видалення</strong> — «право на забуття» (з урахуванням строків зберігання);</li>
            <li><strong>Обмеження обробки</strong> — заблокувати обробку у певних випадках;</li>
            <li><strong>Переносимість</strong> — отримати дані у машинозчитуваному форматі;</li>
            <li><strong>Заперечення</strong> — відмовитись від обробки на підставі законного інтересу.</li>
          </ul>
          <p>
            Для реалізації прав зверніться на:{" "}
            <a href="mailto:privacy@knyha.ua" className="text-blue-600 hover:underline">privacy@knyha.ua</a>.
            Термін відповіді — 30 днів.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Безпека</h2>
          <p>
            Ми застосовуємо технічні та організаційні заходи для захисту даних:
            шифрування при передачі (HTTPS/TLS 1.3), хешування паролів (bcrypt),
            обмеження доступу персоналу за принципом мінімальних привілеїв,
            щоденне резервне копіювання бази даних.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Зміни до Політики</h2>
          <p>
            При суттєвих змінах ми надсилатимемо повідомлення на електронну пошту не менше ніж
            за 14 днів. Продовження використання Платформи після набрання чинності змінами
            означає прийняття нової редакції.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Регулятор</h2>
          <p>
            Якщо ви вважаєте, що ваші права порушено, ви можете звернутись до Уповноваженого Верховної Ради
            України з прав людини або до наглядового органу країни вашого проживання (для резидентів ЄС — GDPR DPA).
          </p>
        </section>

      </div>
    </div>
  );
}
