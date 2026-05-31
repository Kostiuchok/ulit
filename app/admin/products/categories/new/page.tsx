import { db } from "@/lib/db";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  const { parentId } = await searchParams;
  const categories = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });

  return (
    <div className="flex flex-col h-full">
      <AdminTopBar title="Нова категорія" />
      <div className="flex-1 p-6 max-w-2xl">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link href="/admin/products/categories" className="hover:text-foreground">
            Категорії
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Нова категорія</span>
        </nav>

        <CategoryForm
          categories={categories}
          category={
            parentId
              ? ({ parentId: Number(parentId) } as any)
              : undefined
          }
        />
      </div>
    </div>
  );
}
