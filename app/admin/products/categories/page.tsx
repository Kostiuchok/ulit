import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { CategoryActions } from "@/components/admin/categories/CategoryActions";

async function getCategories() {
  return db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

type Cat = Awaited<ReturnType<typeof getCategories>>[0];

function buildTree(cats: Cat[], parentId: number | null = null): Cat[] {
  return cats
    .filter((c) => c.parentId === parentId)
    .map((c) => ({ ...c, children: buildTree(cats, c.id) } as Cat & { children: Cat[] }));
}

function statusBadge(status: string) {
  if (status === "ACTIVE") return <Badge variant="success">Активна</Badge>;
  if (status === "HIDDEN") return <Badge variant="warning">Прихована</Badge>;
  return <Badge variant="secondary">Вимкнена</Badge>;
}

function CategoryRow({ cat, depth = 0 }: { cat: Cat & { children?: Cat[] }; depth?: number }) {
  return (
    <>
      <tr className="border-b hover:bg-muted/30 transition-colors">
        <td className="py-3 px-4">
          <div style={{ paddingLeft: `${depth * 20}px` }} className="flex items-center gap-2">
            {depth > 0 && <span className="text-muted-foreground">└</span>}
            <Link
              href={`/admin/products/categories/${cat.id}`}
              className="font-medium hover:underline"
            >
              {cat.name}
            </Link>
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground">/{cat.slug}</td>
        <td className="py-3 px-4 text-center">
          <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            {cat._count.products}
          </span>
        </td>
        <td className="py-3 px-4">{statusBadge(cat.status)}</td>
        <td className="py-3 px-4 text-right">
          <CategoryActions id={cat.id} name={cat.name} productCount={cat._count.products} />
        </td>
      </tr>
      {(cat as any).children?.map((child: any) => (
        <CategoryRow key={child.id} cat={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  const tree = buildTree(categories as any);

  const total = categories.length;
  const active = categories.filter((c) => c.status === "ACTIVE").length;
  const hidden = categories.filter((c) => c.status === "HIDDEN").length;
  const disabled = categories.filter((c) => c.status === "DISABLED").length;
  const totalProducts = categories.reduce((sum, c) => sum + c._count.products, 0);

  return (
    <div className="flex flex-col h-full">
      <AdminTopBar title="Категорії" />
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Категорії товарів</h2>
          <Button asChild>
            <Link href="/admin/products/categories/new">
              <Plus className="h-4 w-4 mr-1" />
              Нова категорія
            </Link>
          </Button>
        </div>

        <div className="flex gap-6">
          {/* Tree table */}
          <div className="flex-1 rounded-lg border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Назва</th>
                  <th className="py-3 px-4 text-left font-medium">Slug</th>
                  <th className="py-3 px-4 text-center font-medium">Товарів</th>
                  <th className="py-3 px-4 text-left font-medium">Статус</th>
                  <th className="py-3 px-4 text-right font-medium">Дії</th>
                </tr>
              </thead>
              <tbody>
                {tree.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Категорій ще немає.{" "}
                      <Link href="/admin/products/categories/new" className="text-primary hover:underline">
                        Створити першу
                      </Link>
                    </td>
                  </tr>
                ) : (
                  tree.map((cat) => <CategoryRow key={cat.id} cat={cat as any} depth={0} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Summary sidebar */}
          <div className="w-56 shrink-0 space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Зведення</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Всього</span>
                  <span className="font-medium">{total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Активних</span>
                  <span className="font-medium text-green-600">{active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Прихованих</span>
                  <span className="font-medium text-yellow-600">{hidden}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Вимкнених</span>
                  <span className="font-medium text-gray-400">{disabled}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-muted-foreground">Товарів</span>
                  <span className="font-medium">{totalProducts}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
