import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, Users, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <AdminTopBar title="Панель керування" />
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Замовлення сьогодні"
            value="0"
            icon={ShoppingCart}
            description="Нові замовлення"
          />
          <StatCard
            title="Дохід сьогодні"
            value="0 ₴"
            icon={TrendingUp}
            description="Оплачені"
          />
          <StatCard
            title="Товари"
            value="0"
            icon={Package}
            description="Активних"
          />
          <StatCard
            title="Клієнти"
            value="0"
            icon={Users}
            description="Зареєстровані"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Останні замовлення</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Замовлення відсутні</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
