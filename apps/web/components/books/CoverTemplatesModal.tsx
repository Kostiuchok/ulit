"use client";

import { cn } from "../../lib/utils";
import type { Template } from "./CoverDesignerCanvas";

interface Props {
  templates: Template[];
  selectedId: string;
  onSelect: (tpl: Template) => void;
  onClose: () => void;
}

export function CoverTemplatesModal({ templates, selectedId, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Усі доступні стилі обкладинок</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900" aria-label="Закрити">
            ×
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  "h-28 w-20 rounded border-2 transition-colors",
                  tpl.id === selectedId ? "border-primary" : "border-transparent hover:border-gray-300",
                  tpl.thumbnail
                )}
              />
              <span className="text-xs text-gray-600">{tpl.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
