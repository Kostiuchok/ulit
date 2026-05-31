import { auth } from "../../auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">
          Вітаємо, {session?.user?.name}!
        </h1>
        <p className="mt-1 text-gray-500">Ваш кабінет автора на платформі Knyha.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Книги</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">0</p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Продажі</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">0</p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Роялті (грн)</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">0</p>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/dashboard/books/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Нова книга
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Профіль
          </Link>
        </div>
      </div>
    </div>
  );
}
