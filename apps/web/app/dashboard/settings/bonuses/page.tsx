import { Card, CardContent } from "@/components/ui/card";

export default function BonusesPage() {
  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Мої бонуси</h1>
        <Card className="shadow-sm">
          <CardContent className="p-10 text-center">
            <p className="text-lg font-semibold text-gray-700">Незабаром</p>
            <p className="mt-2 text-sm text-gray-500">
              Програма бонусів для авторів ще в розробці. Слідкуйте за оновленнями.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
