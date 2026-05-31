"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { slugify } from "@/lib/utils";

type Category = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  status: string;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  customH1: string | null;
  image: string | null;
  icon: string | null;
  defaultView: string;
  productsPerPage: number;
};

interface Props {
  category?: Category;
  categories: { id: number; name: string; parentId: number | null }[];
}

export function CategoryForm({ category, categories }: Props) {
  const router = useRouter();
  const isEdit = !!category;

  const [name, setName] = useState(category?.name || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [slugManual, setSlugManual] = useState(false);
  const [parentId, setParentId] = useState(String(category?.parentId || ""));
  const [status, setStatus] = useState(category?.status || "ACTIVE");
  const [description, setDescription] = useState(category?.description || "");
  const [metaTitle, setMetaTitle] = useState(category?.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(category?.metaDescription || "");
  const [customH1, setCustomH1] = useState(category?.customH1 || "");
  const [defaultView, setDefaultView] = useState(category?.defaultView || "GRID");
  const [productsPerPage, setProductsPerPage] = useState(String(category?.productsPerPage || 24));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) setSlug(slugify(val));
  }

  // Build flat list excluding self and descendants for parent select
  const parentOptions = categories.filter((c) => c.id !== category?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      name, slug, parentId: parentId || null, status, description,
      metaTitle, metaDescription, customH1, defaultView,
      productsPerPage: Number(productsPerPage),
    };

    try {
      const url = isEdit
        ? `/api/admin/categories/${category!.id}`
        : "/api/admin/categories";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Помилка збереження"); return; }

      router.push("/admin/products/categories");
      router.refresh();
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="main">
        <TabsList>
          <TabsTrigger value="main">Основне</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="display">Відображення</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Назва *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Наприклад: Стелажі"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => { setSlugManual(true); setSlug(e.target.value); }}
              placeholder="napryklad-stelaghi"
            />
            <p className="text-xs text-muted-foreground">Автоматично генерується з назви</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="parent">Батьківська категорія</Label>
            <Select
              id="parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">— Верхній рівень —</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="status">Статус</Label>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ACTIVE">Активна</option>
              <option value="DISABLED">Вимкнена</option>
              <option value="HIDDEN">Прихована</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Опис (SEO-стаття)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Розгорнутий опис категорії для SEO..."
            />
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input
              id="metaTitle"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Якщо пусто — використовується назва"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={3}
              placeholder="До 160 символів"
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">{metaDescription.length}/160</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="customH1">Користувацький H1</Label>
            <Input
              id="customH1"
              value={customH1}
              onChange={(e) => setCustomH1(e.target.value)}
              placeholder="Якщо пусто — використовується назва"
            />
          </div>
        </TabsContent>

        <TabsContent value="display" className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="defaultView">Вид за замовчуванням</Label>
            <Select
              id="defaultView"
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value)}
            >
              <option value="GRID">Сітка</option>
              <option value="LIST">Список</option>
              <option value="COMPACT">Компактний</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="productsPerPage">Товарів на сторінці</Label>
            <Select
              id="productsPerPage"
              value={productsPerPage}
              onChange={(e) => setProductsPerPage(e.target.value)}
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Збереження..." : isEdit ? "Зберегти" : "Створити"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/products/categories")}
        >
          Скасувати
        </Button>
      </div>
    </form>
  );
}
