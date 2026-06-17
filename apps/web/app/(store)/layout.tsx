import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Knyha — Книжковий магазин",
    template: "%s | Knyha",
  },
  description: "Книги від українських авторів — електронні та друковані формати. Читайте та підтримуйте українське письменство.",
  openGraph: {
    siteName: "Knyha",
    locale: "uk_UA",
    type: "website",
  },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
            📚 <span>Knyha</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/books" className="hover:text-gray-900 transition-colors">Каталог</Link>
            <Link href="/books?format=EPUB" className="hover:text-gray-900 transition-colors">Е-книги</Link>
            <Link href="/books?format=PRINT" className="hover:text-gray-900 transition-colors">Друковані</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/books"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Кабінет автора
            </Link>
            <Link
              href="/books"
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              aria-label="Каталог"
            >
              🔍
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t bg-white py-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Knyha — платформа для українських авторів</p>
        <div className="mt-2 flex justify-center gap-6">
          <Link href="/terms" className="hover:text-gray-700">Умови використання</Link>
          <Link href="/privacy" className="hover:text-gray-700">Конфіденційність</Link>
          <Link href="/author-agreement" className="hover:text-gray-700">Договір автора</Link>
        </div>
      </footer>
    </div>
  );
}
