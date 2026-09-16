"use client";

import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Props {
  bookId: string;
  pageCount?: number | null;
  initialStart?: number | null;
  initialEnd?: number | null;
  onSaved?: (start: number | null, end: number | null) => void;
}

export function PreviewRangeEditor({ bookId, pageCount, initialStart, initialEnd, onSaved }: Props) {
  const { apiFetch } = useApi();
  const [start, setStart] = useState<string>(initialStart != null ? String(initialStart) : "");
  const [end, setEnd] = useState<string>(initialEnd != null ? String(initialEnd) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");

    const startVal = start.trim() ? parseInt(start) : null;
    const endVal = end.trim() ? parseInt(end) : null;

    if (startVal !== null && (isNaN(startVal) || startVal < 1)) {
      setError("Початкова сторінка має бути числом від 1");
      setSaving(false);
      return;
    }
    if (endVal !== null && (isNaN(endVal) || endVal < 1)) {
      setError("Кінцева сторінка має бути числом від 1");
      setSaving(false);
      return;
    }
    if (startVal !== null && endVal !== null && endVal <= startVal) {
      setError("Кінцева сторінка має бути більшою за початкову");
      setSaving(false);
      return;
    }

    try {
      await apiFetch(`/api/books/${bookId}/preview`, {
        method: "PATCH",
        body: JSON.stringify({ previewStart: startVal, previewEnd: endVal }),
      });
      setSaved(true);
      onSaved?.(startVal, endVal);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setStart("");
    setEnd("");
  }

  const maxPage = pageCount ?? undefined;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Вкажіть діапазон сторінок для безкоштовного уривку.
        Покупці зможуть читати ці сторінки перед придбанням.
        {pageCount ? ` Книга має ${pageCount} сторінок.` : ""}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">Початок (сторінка)</Label>
          <Input
            type="number"
            min={1}
            max={maxPage}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="1"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">Кінець (сторінка)</Label>
          <Input
            type="number"
            min={1}
            max={maxPage}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder={maxPage ? String(Math.floor(maxPage * 0.1)) : "20"}
          />
        </div>
      </div>

      {/* Visual preview bar */}
      {pageCount && (start || end) && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Уривок</p>
          <div className="relative h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="absolute top-0 h-full rounded-full bg-blue-400"
              style={{
                left: `${((parseInt(start || "1") - 1) / pageCount) * 100}%`,
                width: `${Math.max(
                  2,
                  ((parseInt(end || "1") - parseInt(start || "1") + 1) / pageCount) * 100
                )}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-400">
            {start || 1}–{end || "?"} з {pageCount} сторінок (
            {end && pageCount
              ? Math.round(((parseInt(end) - parseInt(start || "1") + 1) / pageCount) * 100)
              : 0}
            %)
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">✓ Збережено</p>}

      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving} className="bg-gray-900 hover:bg-gray-700">
          Зберегти
        </Button>
        {(start || end) && (
          <Button variant="outline" onClick={handleClear}>
            Прибрати уривок
          </Button>
        )}
      </div>
    </div>
  );
}
