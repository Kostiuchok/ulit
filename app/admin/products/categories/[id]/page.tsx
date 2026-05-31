import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [category, categories] = await Promise.all([
    db.category.findUnique({ where: { id: Number(id) } }),
    db.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  if (!category) notFound();

  return (
    <div className="flex flex-col h-full">
      <AdminTopBar title={category.name} />
      <div className="flex-1 p-6 max-w-2xl">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link href="/admin/products/categories" className="hover:text-foreground">
            Категорії
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{category.name}</span>
        </nav>

        <CategoryForm
          category={{
            id: category.id,
            name: category.name,
            slug: category.slug,
            parentId: category.parentId,
            status: category.status,
            description: category.description,
            metaTitle: category.metaTitle,
            metaDescription: category.metaDescription,
            customH1: category.customH1,
            image: category.image,
            icon: category.icon,
            defaultView: category.defaultView,
            productsPerPage: category.productsPerPage,
          }}
          categories={categories}
        />
      </div>
    </div>
  );
}
