import { BookWizard } from "../../../../components/books/BookWizard";

export default function NewBookPage() {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Нова книга</h1>
          <p className="mt-1 text-sm text-gray-500">Заповніть інформацію крок за кроком</p>
        </div>
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <BookWizard />
        </div>
      </div>
    </div>
  );
}
