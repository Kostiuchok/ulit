import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Dev: log emails to console
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const transporter = createTransport();
const FROM = process.env.SMTP_FROM || "noreply@knyha.ua";

async function sendMail(to: string, subject: string, html: string) {
  const info = await transporter.sendMail({ from: `Knyha <${FROM}>`, to, subject, html });
  if (process.env.SMTP_HOST === undefined) {
    console.log("[email] (dev transport)", JSON.parse((info as any).message));
  }
}

export async function sendKdpExpiryWarning(opts: {
  email: string;
  name: string;
  bookTitle: string;
  bookId: string;
  expiryDate: Date;
}) {
  const { email, name, bookTitle, bookId, expiryDate } = opts;
  const fmtDate = expiryDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/books/${bookId}`;

  await sendMail(
    email,
    `⏰ KDP Select закінчується ${fmtDate} — "${bookTitle}"`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a2e">Нагадування про KDP Select</h2>
      <p>Вітаємо, ${name}!</p>
      <p>Через <strong>7 днів</strong> (${fmtDate}) завершується 90-денний ексклюзивний період KDP Select для книги:</p>
      <p style="font-size:1.1em;font-weight:bold;color:#333">"${bookTitle}"</p>
      <p>Після закінчення ексклюзиву ви зможете:</p>
      <ul>
        <li>Залишити книгу на KDP Select ще на 90 днів</li>
        <li>Перейти на широке розповсюдження (Draft2Digital, Google Play Books)</li>
      </ul>
      <a href="${dashboardUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2d2d2d;color:#fff;text-decoration:none;border-radius:6px">
        Відкрити книгу
      </a>
      <p style="margin-top:32px;font-size:0.8em;color:#888">Платформа Knyha — knyha.ua</p>
    </div>
    `
  );
}

export async function sendOrderDownloadLinks(opts: {
  email: string;
  name: string;
  orderId: string;
  total: number;
  downloads: Array<{
    bookTitle: string;
    coverUrl: string | null;
    links: Array<{ label: string; url: string }>;
  }>;
}) {
  const { email, name, orderId, total, downloads } = opts;
  const orderUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/orders/${orderId}`;

  const booksHtml = downloads
    .map(
      (b) => `
        <div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
          <p style="margin:0 0 8px;font-weight:bold;color:#111">${b.bookTitle}</p>
          ${b.links
            .map(
              (l) =>
                `<a href="${l.url}" style="display:inline-block;margin:4px 4px 0 0;padding:6px 14px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:4px;font-size:0.85em">
                  ⬇ ${l.label}
                </a>`
            )
            .join("")}
        </div>`
    )
    .join("");

  await sendMail(
    email,
    `✅ Ваше замовлення оплачено — завантажте книги`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a2e">Дякуємо за покупку, ${name}!</h2>
      <p>Сума замовлення: <strong>${total.toFixed(2)} грн</strong></p>
      <div style="margin:16px 0;padding:12px 16px;background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;color:#92400e">
        <strong>⏳ Важливо:</strong> посилання на завантаження дійсні <strong>48 годин</strong> з моменту отримання цього листа. Завантажте файли та збережіть їх на свій пристрій.
      </div>
      ${booksHtml}
      <p style="margin-top:16px">
        <a href="${orderUrl}" style="color:#2563eb">Переглянути замовлення</a>
      </p>
      <p style="margin-top:32px;font-size:0.8em;color:#888">Платформа Knyha — knyha.ua</p>
    </div>
    `
  );
}

export async function sendPublishedNotification(opts: {
  email: string;
  name: string;
  bookTitle: string;
  bookId: string;
  isbn?: string | null;
}) {
  const { email, name, bookTitle, bookId, isbn } = opts;
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/books/${bookId}`;

  await sendMail(
    email,
    `✅ Книга опублікована — "${bookTitle}"`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a2e">Вашу книгу опубліковано!</h2>
      <p>Вітаємо, ${name}!</p>
      <p>Книга <strong>"${bookTitle}"</strong> успішно пройшла модерацію і тепер доступна в магазині.</p>
      ${isbn ? `<p>ISBN: <strong>${isbn}</strong></p>` : ""}
      <a href="${dashboardUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2d2d2d;color:#fff;text-decoration:none;border-radius:6px">
        Перейти до книги
      </a>
      <p style="margin-top:32px;font-size:0.8em;color:#888">Платформа Knyha — knyha.ua</p>
    </div>
    `
  );
}
