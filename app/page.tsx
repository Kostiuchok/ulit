import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">СКЛАДКОМ</h1>
        <p className="mt-2 text-gray-600">Stелажі, меблі, драбини, сейфи</p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/admin"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Адмін-панель
          </Link>
        </div>
      </div>
    </div>
  );
}
