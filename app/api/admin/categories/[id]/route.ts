import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { CategoryStatus, ViewType } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const category = await db.category.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  return NextResponse.json(category);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { name, parentId, status, description, metaTitle, metaDescription, customH1, image, icon, defaultView, productsPerPage, position } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Назва обов'язкова" }, { status: 400 });
  }

  const current = await db.category.findUnique({ where: { id: Number(id) } });
  if (!current) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  let slug = current.slug;
  if (slugify(name) !== slugify(current.name)) {
    slug = slugify(name);
    const existing = await db.category.findFirst({ where: { slug, NOT: { id: Number(id) } } });
    if (existing) slug = `${slug}-${Date.now()}`;
  }

  const category = await db.category.update({
    where: { id: Number(id) },
    data: {
      name: name.trim(),
      slug,
      parentId: parentId ? Number(parentId) : null,
      status: (status as CategoryStatus) || "ACTIVE",
      description: description || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      customH1: customH1 || null,
      image: image || null,
      icon: icon || null,
      defaultView: (defaultView as ViewType) || "GRID",
      productsPerPage: productsPerPage ? Number(productsPerPage) : 24,
      position: position !== undefined ? Number(position) : current.position,
    },
  });

  return NextResponse.json(category);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const children = await db.category.count({ where: { parentId: Number(id) } });
  if (children > 0) {
    return NextResponse.json(
      { error: "Спочатку видаліть або перемістіть підкатегорії" },
      { status: 400 }
    );
  }

  const products = await db.productCategory.count({ where: { categoryId: Number(id) } });
  if (products > 0) {
    return NextResponse.json(
      { error: `Категорія містить ${products} товарів. Спочатку перемістіть їх.` },
      { status: 400 }
    );
  }

  await db.category.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
