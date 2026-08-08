"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// Same proportions as the front cover for a consistent print spread.
const DISPLAY_W = 350;
const DISPLAY_H = 525;
const EXPORT_SCALE = 1800 / DISPLAY_W;

const FONTS = ["Arial", "Georgia", "Helvetica", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS"];

// Rough print-industry estimate (~0.1mm per page on standard offset paper) —
// informational only, not fed into any PDF/print generation yet.
function estimateSpineMm(pageCount?: number | null): number | null {
  if (!pageCount || pageCount <= 0) return null;
  return Math.round(pageCount * 0.1 * 10) / 10;
}

interface Props {
  bookId: string;
  pageCount?: number | null;
  existingBackCoverUrl?: string | null;
  onSaved: (url: string) => void;
  token?: string;
}

export function BackCoverEditor({ bookId, pageCount, existingBackCoverUrl, onSaved, token }: Props) {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bgColor, setBgColor] = useState("#111111");
  const [textColor, setTextColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Georgia");
  const [textInput, setTextInput] = useState("");
  const [activeObj, setActiveObj] = useState<fabric.Object | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const spineMm = estimateSpineMm(pageCount);

  useEffect(() => {
    if (!canvasEl.current) return;
    const canvas = new fabric.Canvas(canvasEl.current, { width: DISPLAY_W, height: DISPLAY_H, backgroundColor: "#111111" });
    canvasRef.current = canvas;

    canvas.on("selection:created", (e) => setActiveObj(e.selected?.[0] ?? null));
    canvas.on("selection:updated", (e) => setActiveObj(e.selected?.[0] ?? null));
    canvas.on("selection:cleared", () => setActiveObj(null));

    if (existingBackCoverUrl) {
      fabric.Image.fromURL(existingBackCoverUrl, (img) => {
        const scaleX = DISPLAY_W / (img.width ?? DISPLAY_W);
        const scaleY = DISPLAY_H / (img.height ?? DISPLAY_H);
        const scale = Math.max(scaleX, scaleY);
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: false, evented: false, data: { role: "bg" } });
        canvas.add(img);
        canvas.sendToBack(img);
        canvas.renderAll();
      }, { crossOrigin: "anonymous" });
    }

    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBgColor(color);
    const existing = canvas.getObjects().find((o: any) => o.data?.role === "bg");
    if (existing) canvas.remove(existing);
    canvas.backgroundColor = color;
    canvas.renderAll();
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      fabric.Image.fromURL(dataUrl, (img) => {
        const scaleX = DISPLAY_W / (img.width ?? DISPLAY_W);
        const scaleY = DISPLAY_H / (img.height ?? DISPLAY_H);
        const scale = Math.max(scaleX, scaleY);
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: false, evented: false, data: { role: "bg" } });
        const existing = canvas.getObjects().find((o: any) => o.data?.role === "bg");
        if (existing) canvas.remove(existing);
        canvas.add(img);
        canvas.sendToBack(img);
        canvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const addText = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = new fabric.IText(textInput || "Анотація…", {
      left: DISPLAY_W / 2,
      top: DISPLAY_H / 2,
      fontSize,
      fill: textColor,
      fontFamily,
      textAlign: "center",
      originX: "center",
      originY: "center",
      width: DISPLAY_W - 60,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }, [textInput, fontSize, textColor, fontFamily]);

  const updateSelected = useCallback((patch: Partial<fabric.IText>) => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as fabric.IText | undefined;
    if (!obj) return;
    obj.set(patch as any);
    canvas!.renderAll();
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (obj && !(obj as any).data?.role) {
      canvas!.remove(obj);
      canvas!.renderAll();
    }
  }, []);

  const saveBackCover = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setSaveError("");
    try {
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: EXPORT_SCALE });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const form = new FormData();
      form.append("file", blob, "back-cover.png");

      const uploadRes = await fetch(`/api/books/${bookId}/upload-back-cover`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      const { backCoverUrl } = await uploadRes.json();
      onSaved(`${backCoverUrl.split("?")[0]}?t=${Date.now()}`);
    } catch (e: any) {
      setSaveError(e.message || "Помилка збереження задньої сторінки");
    } finally {
      setSaving(false);
    }
  }, [bookId, token, onSaved]);

  const isText = activeObj?.type === "i-text" || activeObj?.type === "text";

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-lg border-2 border-gray-200 overflow-hidden shadow-md">
          <canvas ref={canvasEl} />
        </div>
        {spineMm && (
          <p className="text-xs text-gray-400">
            Орієнтовна товщина корінця: ~{spineMm}мм ({pageCount} стор.)
          </p>
        )}
        <Button onClick={saveBackCover} loading={saving} className="w-full">
          Зберегти задню сторінку
        </Button>
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      </div>

      <div className="flex-1 space-y-4 min-w-0">
        <div className="space-y-1">
          <Label>Колір фону</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={bgColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border" />
            <span className="text-xs text-gray-500 font-mono">{bgColor}</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Власне зображення</Label>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full">
            Завантажити фото
          </Button>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Додати текст (анотація, про автора…)</p>
          <Input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Текст…" />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Шрифт</Label>
              <select
                value={fontFamily}
                onChange={(e) => { setFontFamily(e.target.value); updateSelected({ fontFamily: e.target.value }); }}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Розмір</Label>
              <Input
                type="number" min={8} max={72}
                value={fontSize}
                onChange={(e) => { setFontSize(Number(e.target.value)); updateSelected({ fontSize: Number(e.target.value) }); }}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Колір</Label>
            <input type="color" value={textColor} onChange={(e) => { setTextColor(e.target.value); updateSelected({ fill: e.target.value }); }} className="h-7 w-12 cursor-pointer rounded border" />
          </div>
          <Button size="sm" onClick={addText} className="w-full">+ Додати</Button>
        </div>

        {isText && (
          <div className="rounded-lg border p-3">
            <Button size="sm" variant="destructive" onClick={deleteSelected} className="w-full text-xs">
              Видалити вибраний текст
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
