"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fabric } from "fabric";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../../lib/utils";

// Cover dimensions — display vs export
const DISPLAY_W = 350;
const DISPLAY_H = 525;
const EXPORT_SCALE = 1800 / DISPLAY_W; // ~5.14× → 1800×2700px

// ─── Templates ────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  label: string;
  thumbnail: string;
  apply: (canvas: fabric.Canvas, title: string, author: string) => void;
};

function makeGradientRect(canvas: fabric.Canvas, colors: string[]) {
  const gradient = new fabric.Gradient({
    type: "linear",
    coords: { x1: 0, y1: 0, x2: 0, y2: DISPLAY_H },
    colorStops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })),
  });
  const bg = new fabric.Rect({ left: 0, top: 0, width: DISPLAY_W, height: DISPLAY_H, fill: gradient, selectable: false, evented: false, data: { role: "bg" } });
  canvas.add(bg);
  canvas.sendToBack(bg);
}

const TEMPLATES: Template[] = [
  {
    id: "classic",
    label: "Класик",
    thumbnail: "bg-gradient-to-b from-gray-900 to-gray-700",
    apply(canvas, title, author) {
      canvas.clear();
      makeGradientRect(canvas, ["#1a1a2e", "#16213e"]);
      canvas.add(new fabric.Rect({ left: 20, top: 60, width: DISPLAY_W - 40, height: 2, fill: "#c9a96e", selectable: false }));
      canvas.add(new fabric.Text(title, { left: DISPLAY_W / 2, top: 90, fontSize: 32, fill: "#f5e6c8", fontFamily: "Georgia", fontWeight: "bold", textAlign: "center", originX: "center", width: DISPLAY_W - 40 }));
      canvas.add(new fabric.Rect({ left: 20, top: DISPLAY_H - 80, width: DISPLAY_W - 40, height: 1, fill: "#c9a96e", selectable: false }));
      canvas.add(new fabric.Text(author, { left: DISPLAY_W / 2, top: DISPLAY_H - 65, fontSize: 16, fill: "#c9a96e", fontFamily: "Georgia", textAlign: "center", originX: "center" }));
    },
  },
  {
    id: "minimal",
    label: "Мінімал",
    thumbnail: "bg-white border border-gray-200",
    apply(canvas, title, author) {
      canvas.clear();
      const bg = new fabric.Rect({ left: 0, top: 0, width: DISPLAY_W, height: DISPLAY_H, fill: "#fafafa", selectable: false, evented: false, data: { role: "bg" } });
      canvas.add(bg); canvas.sendToBack(bg);
      canvas.add(new fabric.Rect({ left: 30, top: 30, width: 4, height: DISPLAY_H - 60, fill: "#2d2d2d", selectable: false }));
      canvas.add(new fabric.Text(title, { left: 50, top: 60, fontSize: 28, fill: "#1a1a1a", fontFamily: "Helvetica", fontWeight: "bold", width: DISPLAY_W - 70 }));
      canvas.add(new fabric.Text(author.toUpperCase(), { left: 50, top: DISPLAY_H - 50, fontSize: 11, fill: "#888", fontFamily: "Helvetica", charSpacing: 200 }));
    },
  },
  {
    id: "bold",
    label: "Яскравий",
    thumbnail: "bg-gradient-to-br from-orange-500 to-pink-600",
    apply(canvas, title, author) {
      canvas.clear();
      makeGradientRect(canvas, ["#f97316", "#ec4899"]);
      canvas.add(new fabric.Text(title, { left: DISPLAY_W / 2, top: DISPLAY_H / 2 - 60, fontSize: 36, fill: "#fff", fontFamily: "Arial", fontWeight: "bold", textAlign: "center", originX: "center", width: DISPLAY_W - 30, shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.4)", blur: 8, offsetX: 2, offsetY: 2 }) }));
      canvas.add(new fabric.Text("—  " + author + "  —", { left: DISPLAY_W / 2, top: DISPLAY_H / 2 + 80, fontSize: 14, fill: "rgba(255,255,255,0.85)", fontFamily: "Arial", textAlign: "center", originX: "center" }));
    },
  },
  {
    id: "dark-elegance",
    label: "Елегант",
    thumbnail: "bg-gradient-to-b from-slate-900 to-violet-950",
    apply(canvas, title, author) {
      canvas.clear();
      makeGradientRect(canvas, ["#0f0c29", "#302b63", "#24243e"]);
      canvas.add(new fabric.Text(title, { left: DISPLAY_W / 2, top: 160, fontSize: 30, fill: "#e8d5b7", fontFamily: "Georgia", fontStyle: "italic", textAlign: "center", originX: "center", width: DISPLAY_W - 50 }));
      canvas.add(new fabric.Line([60, DISPLAY_H / 2, DISPLAY_W - 60, DISPLAY_H / 2], { stroke: "#a78bfa", strokeWidth: 1, selectable: false }));
      canvas.add(new fabric.Text(author, { left: DISPLAY_W / 2, top: DISPLAY_H - 70, fontSize: 14, fill: "#a78bfa", fontFamily: "Georgia", textAlign: "center", originX: "center", charSpacing: 100 }));
    },
  },
  {
    id: "nature",
    label: "Природа",
    thumbnail: "bg-gradient-to-b from-emerald-800 to-teal-600",
    apply(canvas, title, author) {
      canvas.clear();
      makeGradientRect(canvas, ["#064e3b", "#065f46", "#047857"]);
      for (let i = 0; i < 8; i++) {
        canvas.add(new fabric.Circle({ left: Math.random() * DISPLAY_W, top: Math.random() * DISPLAY_H, radius: 40 + Math.random() * 60, fill: "rgba(255,255,255,0.03)", selectable: false }));
      }
      canvas.add(new fabric.Text(title, { left: DISPLAY_W / 2, top: 120, fontSize: 32, fill: "#ecfdf5", fontFamily: "Georgia", fontWeight: "bold", textAlign: "center", originX: "center", width: DISPLAY_W - 40 }));
      canvas.add(new fabric.Text(author, { left: DISPLAY_W / 2, top: DISPLAY_H - 55, fontSize: 13, fill: "#6ee7b7", fontFamily: "Georgia", textAlign: "center", originX: "center" }));
    },
  },
];

// ─── Fonts ─────────────────────────────────────────────────────────────────────

const FONTS = ["Arial", "Georgia", "Helvetica", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS"];

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  existingCoverUrl?: string | null;
  onSaved: (url: string) => void;
}

export default function CoverDesignerCanvas({ bookId, bookTitle, bookAuthor, existingCoverUrl, onSaved }: Props) {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeObj, setActiveObj] = useState<fabric.Object | null>(null);
  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [textColor, setTextColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(28);
  const [fontFamily, setFontFamily] = useState("Georgia");
  const [textInput, setTextInput] = useState("");
  const [unsplashQuery, setUnsplashQuery] = useState("book");
  const [unsplashPhotos, setUnsplashPhotos] = useState<any[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"templates" | "bg" | "unsplash">("templates");

  // Init canvas
  useEffect(() => {
    if (!canvasEl.current) return;
    const canvas = new fabric.Canvas(canvasEl.current, { width: DISPLAY_W, height: DISPLAY_H, backgroundColor: "#1a1a2e" });
    canvasRef.current = canvas;

    canvas.on("selection:created", (e) => setActiveObj(e.selected?.[0] ?? null));
    canvas.on("selection:updated", (e) => setActiveObj(e.selected?.[0] ?? null));
    canvas.on("selection:cleared", () => setActiveObj(null));

    // Apply default template
    TEMPLATES[0].apply(canvas, bookTitle, bookAuthor);
    canvas.renderAll();

    return () => { canvas.dispose(); canvasRef.current = null; };
  }, []);

  // ── Toolbar actions ──────────────────────────────────────────────────────────

  const addText = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = new fabric.IText(textInput || "Новий текст", {
      left: DISPLAY_W / 2,
      top: DISPLAY_H / 2,
      fontSize,
      fill: textColor,
      fontFamily,
      originX: "center",
      originY: "center",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }, [textInput, fontSize, textColor, fontFamily]);

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && !(obj as any).data?.role) {
      canvas.remove(obj);
      canvas.renderAll();
    }
  }, []);

  const updateSelected = useCallback((patch: Partial<fabric.IText>) => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as fabric.IText | undefined;
    if (!obj) return;
    obj.set(patch as any);
    canvas!.renderAll();
  }, []);

  const bringForward = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (obj) { canvas!.bringForward(obj); canvas!.renderAll(); }
  }, []);

  const sendBackward = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (obj && !(obj as any).data?.role) { canvas!.sendBackwards(obj); canvas!.renderAll(); }
  }, []);

  const applyTemplate = useCallback((tpl: Template) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tpl.apply(canvas, bookTitle, bookAuthor);
    canvas.renderAll();
  }, [bookTitle, bookAuthor]);

  const setBackgroundColor = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBgColor(color);
    const existing = canvas.getObjects().find((o: any) => o.data?.role === "bg");
    if (existing) { (existing as fabric.Rect).set("fill", color); }
    else { canvas.backgroundColor = color; }
    canvas.renderAll();
  }, []);

  const loadImageFromUrl = useCallback((url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fabric.Image.fromURL(url, (img) => {
      const scaleX = DISPLAY_W / (img.width ?? DISPLAY_W);
      const scaleY = DISPLAY_H / (img.height ?? DISPLAY_H);
      const scale = Math.max(scaleX, scaleY);
      img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: false, evented: false, data: { role: "bg-img" } });
      const existing = canvas.getObjects().find((o: any) => o.data?.role === "bg-img");
      if (existing) canvas.remove(existing);
      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
    }, { crossOrigin: "anonymous" });
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) loadImageFromUrl(ev.target.result as string); };
    reader.readAsDataURL(file);
  }, [loadImageFromUrl]);

  const searchUnsplash = useCallback(async () => {
    setUnsplashLoading(true);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(unsplashQuery)}`);
      const data = await res.json();
      setUnsplashPhotos(data.photos ?? []);
    } catch { setUnsplashPhotos([]); }
    finally { setUnsplashLoading(false); }
  }, [unsplashQuery]);

  // ── Export & save ────────────────────────────────────────────────────────────

  const saveToBook = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setSaveError("");

    try {
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: EXPORT_SCALE });
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const apiToken = (window as any).__NEXT_DATA__?.props?.pageProps?.session?.user?.apiToken
        ?? document.cookie.match(/apiToken=([^;]+)/)?.[1]
        ?? localStorage.getItem("knyha-token") ?? "";

      // Use the session apiToken stored by our useApi hook
      const session = await fetch("/api/auth/session").then(r => r.json()).catch(() => ({}));
      const token = session?.user?.apiToken ?? "";

      const form = new FormData();
      form.append("file", blob, "cover.png");

      const uploadRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/books/${bookId}/upload-cover`,
        { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }
      );

      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }

      const { coverUrl } = await uploadRes.json();
      onSaved(coverUrl);
    } catch (e: any) {
      setSaveError(e.message || "Помилка збереження обкладинки");
    } finally {
      setSaving(false);
    }
  }, [bookId, onSaved]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const isText = activeObj?.type === "i-text" || activeObj?.type === "text";

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Canvas */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-lg border-2 border-gray-200 overflow-hidden shadow-md">
          <canvas ref={canvasEl} />
        </div>
        <p className="text-xs text-gray-400">Подвійний клік на тексті для редагування</p>
        <Button onClick={saveToBook} loading={saving} className="w-full">
          Зберегти обкладинку
        </Button>
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      </div>

      {/* Toolbar */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border p-1 bg-gray-50">
          {(["templates", "bg", "unsplash"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-colors", activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
            >
              {tab === "templates" ? "Шаблони" : tab === "bg" ? "Фон" : "Unsplash"}
            </button>
          ))}
        </div>

        {/* Templates */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className="group flex flex-col items-center gap-1"
              >
                <div className={cn("h-16 w-11 rounded border-2 border-transparent group-hover:border-primary transition-colors", tpl.thumbnail)} />
                <span className="text-xs text-gray-600">{tpl.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Background */}
        {activeTab === "bg" && (
          <div className="space-y-3">
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
          </div>
        )}

        {/* Unsplash */}
        {activeTab === "unsplash" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={unsplashQuery}
                onChange={(e) => setUnsplashQuery(e.target.value)}
                placeholder="Пошук зображень…"
                onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
              />
              <Button size="sm" onClick={searchUnsplash} loading={unsplashLoading}>Пошук</Button>
            </div>
            {unsplashPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                {unsplashPhotos.map((p) => (
                  <button key={p.id} onClick={() => loadImageFromUrl(p.regular)} className="overflow-hidden rounded border hover:opacity-80 transition-opacity">
                    <img src={p.thumb} alt={p.authorName} className="h-16 w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Введіть запит і натисніть Пошук</p>
            )}
          </div>
        )}

        {/* Text tool */}
        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Додати текст</p>
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
                type="number"
                min={8}
                max={120}
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

        {/* Object actions */}
        {activeObj && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Вибраний об'єкт</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={bringForward} className="flex-1 text-xs">↑ Вперед</Button>
              <Button size="sm" variant="outline" onClick={sendBackward} className="flex-1 text-xs">↓ Назад</Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected} className="flex-1 text-xs">Видалити</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
