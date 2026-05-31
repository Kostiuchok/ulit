"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";

interface Props {
  id: number;
  name: string;
  productCount: number;
}

export function CategoryActions({ id, name, productCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.refresh();
    } catch {
      setError("Помилка видалення");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-background shadow-md">
            <Link
              href={`/admin/products/categories/new?parentId=${id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setMenuOpen(false)}
            >
              <Plus className="h-3.5 w-3.5" />
              Підкатегорія
            </Link>
            <Link
              href={`/admin/products/categories/${id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setMenuOpen(false)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Редагувати
            </Link>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-muted"
              onClick={() => { setMenuOpen(false); setOpen(true); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Видалити
            </button>
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={`Видалити «${name}»?`}
        description={
          productCount > 0
            ? `Категорія містить ${productCount} товарів. Спочатку перемістіть їх.`
            : "Цю дію не можна скасувати."
        }
        confirmLabel={deleting ? "Видалення..." : "Видалити"}
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}
