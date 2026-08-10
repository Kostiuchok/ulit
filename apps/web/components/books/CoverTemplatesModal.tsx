"use client";

import { cn } from "../../lib/utils";
import type { Template } from "./CoverDesignerCanvas";

interface Props {
  templates: Template[];
  selectedId: string;
  onSelect: (tpl: Template) => void;
  onClose: () => void;
}

// Inline expanding panel (not a modal) — sits directly under the "Список
// усіх макетів" toggle button in the sidebar and pushes the rest of the
// panel down, closed either via the × here or by clicking that same button
// again.
export function CoverTemplatesModal({ templates, selectedId, onSelect, onClose }: Props) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900">Усі доступні стилі обкладинок</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900" aria-label="Закрити">
          ×
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={cn(
                "h-24 w-16 rounded border-2 transition-colors",
                tpl.id === selectedId ? "border-primary" : "border-transparent hover:border-gray-300",
                tpl.thumbnail
              )}
            />
            <span className="text-xs text-gray-600">{tpl.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
