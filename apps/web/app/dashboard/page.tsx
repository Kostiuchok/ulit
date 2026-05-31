import { auth } from "../../auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">
          Вітаємо, {session.user?.name}!
        </h1>
        <p className="mt-2 text-gray-600">Ваш кабінет автора на платформі Knyha.</p>

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
      </div>
    </div>
  );
}
