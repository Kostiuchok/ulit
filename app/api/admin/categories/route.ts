import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { CategoryStatus, ViewType } from "@prisma/client";

export async function GET() {
  const categories = await db.category.findMany({
    orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
    },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, parentId, status, description, metaTitle, metaDescription, customH1, image, icon, defaultView, productsPerPage } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Назва обов'язкова" }, { status: 400 });
  }

  let slug = slugify(name);
  const existing = await db.category.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const maxPos = await db.category.aggregate({ _max: { position: true } });
  const position = (maxPos._max.position ?? 0) + 1;

  const category = await db.category.create({
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
      position,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
