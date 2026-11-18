# 06d «Обкладинка — автоматична за шаблоном» (cover.html?state=auto). Підключається з build.py (exec).
# Кожен стиль — готовий набір: фон, блоки, колір тексту (підібрано для контрасту). Окремих контролів кольору немає.
STYLES = [
 # family, variant, bg, fg(title), sub(author), decor, accent — альфа: 12 стилів
 ("Класик","темна","#1f2937","#ffffff","#d1d5db","band-photo","#111827"),
 ("Класик","світла","#f5f5f4","#111827","#4b5563","band-photo","#ffffff"),
 ("Мінімал","темна","#111111","#fafafa","#a3a3a3","none",""),
 ("Мінімал","світла","#ffffff","#111111","#6b7280","none",""),
 ("Мінімал","пастельна","#fde68a","#422006","#78350f","none",""),
 ("Текстури","кольорова","#7c3aed","#ffffff","#ede9fe","blobs","#f472b6"),
 ("Текстури","квіти","#14532d","#fefce8","#d9f99d","flowers","#facc15"),
 ("Текстури","місто","#1e3a8a","#ffffff","#bfdbfe","city","#0f172a"),
 ("Патерн","кружечки","#fef3c7","#7c2d12","#9a3412","dots","#f59e0b"),
 ("Патерн","квадрати","#dbeafe","#1e3a8a","#1d4ed8","squares","#93c5fd"),
 ("Патерн","фігури","#fce7f3","#831843","#9d174d","shapes","#f472b6"),
 ("Патерн","конфеті","#0f766e","#ffffff","#ccfbf1","confetti","#fde047"),
]
FAMILIES = [("Класик",2),("Мінімал",3),("Текстури",3),("Патерн",4)]
N = len(STYLES)
GENRE = "Поезія"  # жанр книги → перший стиль (мапа — у WF-SPEC)

def cover_art(i, w, title="Назва книги", author="e2e", photo_ok=True, long=False):
    fam, var, bg, fg, sub, decor, acc = STYLES[i]
    h = round(w * 200 / 130)
    u = w / 100  # 1% ширини
    els = []
    A = lambda style, extra="": els.append(f'<span class="absolute {extra}" style="{style}"></span>')
    if decor in ("band", "band-photo"):
        A(f"left:0;right:0;top:0;height:{34*h/100:.0f}px;background:{acc}")
        if decor == "band-photo" and photo_ok:
            els.append(f'<span class="absolute flex items-center justify-center bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-white/80" style="left:0;right:0;top:{34*h/100:.0f}px;height:{44*h/100:.0f}px">{ic("image","!w-[{0:.0f}px] !h-[{0:.0f}px]".format(max(10,9*u)))}</span>')
    elif decor == "frame":
        A(f"inset:{6*u:.0f}px;border:{max(1,0.8*u):.1f}px solid {acc}")
    elif decor in ("blobs", "blobs-mono"):
        for (x, y, r, o) in [(-10, 55, 70, .55), (55, 70, 60, .45), (30, -15, 55, .35)]:
            A(f"left:{x}%;top:{y}%;width:{r*u:.0f}px;height:{r*u:.0f}px;border-radius:9999px;background:{acc};opacity:{o}")
    elif decor == "flowers":
        for (x, y, r) in [(10, 62, 16), (32, 74, 12), (60, 66, 18), (78, 80, 12), (18, 86, 10), (48, 88, 14), (84, 58, 9)]:
            A(f"left:{x}%;top:{y}%;width:{r*u:.0f}px;height:{r*u:.0f}px;border-radius:9999px;background:{acc};box-shadow:0 0 0 {r*u/4:.0f}px #fde68a55")
            A(f"left:calc({x}% + {r*u/2-0.8*u:.0f}px);top:calc({y}% + {r*u:.0f}px);width:{1.6*u:.0f}px;height:{10*u:.0f}px;background:#65a30d")
    elif decor == "city":
        x = 0
        for (bw, bh) in [(12, 22), (9, 34), (14, 18), (10, 40), (13, 26), (8, 31), (15, 20), (11, 36), (8, 24)]:
            A(f"left:{x}%;bottom:0;width:{bw}%;height:{bh}%;background:{acc}")
            x += bw
        A(f"left:70%;top:58%;width:{6*u:.0f}px;height:{6*u:.0f}px;border-radius:9999px;background:#fde68a")
    elif decor == "paper":
        for k in range(9):
            A(f"left:8%;right:8%;top:{52+k*5}%;height:1px;background:{acc}")
    elif decor in ("dots", "squares", "grid", "diamonds", "confetti", "shapes", "stripes"):
        cols, rows = 6, 9
        cw, ch = w / cols, h / rows
        for r in range(rows):
            for c in range(cols):
                if r in (2, 3, 4) and decor not in ("stripes",):  # поле під назву лишаємо чистим
                    continue
                x0, y0 = c * cw, r * ch
                if decor == "dots":
                    A(f"left:{x0+cw*.3:.0f}px;top:{y0+ch*.3:.0f}px;width:{cw*.4:.0f}px;height:{cw*.4:.0f}px;border-radius:9999px;background:{acc}")
                elif decor == "squares":
                    A(f"left:{x0+cw*.25:.0f}px;top:{y0+ch*.25:.0f}px;width:{cw*.5:.0f}px;height:{cw*.5:.0f}px;background:{acc}")
                elif decor == "grid":
                    A(f"left:{x0:.0f}px;top:{y0:.0f}px;width:{cw:.0f}px;height:{ch:.0f}px;border:1px solid {acc}")
                elif decor == "diamonds":
                    A(f"left:{x0+cw*.28:.0f}px;top:{y0+ch*.28:.0f}px;width:{cw*.44:.0f}px;height:{cw*.44:.0f}px;background:{acc};transform:rotate(45deg)")
                elif decor == "confetti":
                    colors = ["#fde047", "#f472b6", "#60a5fa", "#ffffff"]
                    A(f"left:{x0+cw*((r*7+c*3)%5)/6:.0f}px;top:{y0+ch*((r*3+c*5)%4)/5:.0f}px;width:{cw*.25:.0f}px;height:{cw*.12:.0f}px;background:{colors[(r+c)%4]};transform:rotate({(r*37+c*53)%180}deg)")
                elif decor == "shapes":
                    k = (r + c) % 3
                    rad = "9999px" if k == 0 else ("0" if k == 1 else "0 9999px 0 9999px")
                    A(f"left:{x0+cw*.2:.0f}px;top:{y0+ch*.2:.0f}px;width:{cw*.55:.0f}px;height:{cw*.55:.0f}px;border-radius:{rad};background:{acc};opacity:{.5+.25*k}")
                elif decor == "stripes" and c == 0:
                    if r % 2 == 0:
                        A(f"left:0;right:0;top:{y0:.0f}px;height:{ch*.5:.0f}px;background:{acc}")
    # поле під назву для патернів (щоб текст читався)
    if decor in ("dots", "squares", "grid", "diamonds", "confetti", "shapes", "stripes"):
        A(f"left:{8*u:.0f}px;right:{8*u:.0f}px;top:{h*2/9:.0f}px;height:{h*3/9:.0f}px;background:{bg};border-radius:{2*u:.0f}px")
    t = title
    fs = 11 * u if not long else 7.2 * u
    title_top = 9 if decor in ("band", "band-photo") else (30 if decor not in ("city", "flowers", "paper", "blobs", "blobs-mono") else 14)
    tcolor = fg
    title_html = f'<div class="absolute text-center font-bold leading-tight" style="left:{8*u:.0f}px;right:{8*u:.0f}px;top:{title_top}%;font-size:{fs:.1f}px;color:{tcolor}">{t}</div>'
    a_top = "bottom:6%" if decor in ("band-photo",) else ("top:" + str(title_top + (16 if not long else 26)) + "%")
    if decor in ("city", "flowers", "paper", "blobs", "blobs-mono"):
        a_top = f"top:{title_top + (16 if not long else 26)}%"
    acolor = sub if decor != "band-photo" else (sub if bg != "#f5f5f4" else "#374151")
    author_html = f'<div class="absolute text-center font-medium" style="left:0;right:0;{a_top};font-size:{5.2*u:.1f}px;color:{acolor}">{author}</div>'
    return f'<div class="relative overflow-hidden" style="width:{w}px;height:{h}px;background:{bg}">{"".join(els)}{title_html}{author_html}</div>'

SAVED = 6  # збережена обкладинка опублікованої книги (06/06b/06c) — той самий стиль «Текстури · квіти»

def print_spread(i, W=230, spine_mm=1.2, hard=False, guides=False, caption=True):
    """Друкований розворот у масштабі: задня 130×200 мм · корінець (мм → px у тому ж масштабі) · лицева 130×200 мм."""
    fam_, var, bg, fg, sub, decor, acc = STYLES[i]
    H = round(W * 200 / 130)
    mm = W / 130  # px на 1 мм
    sp = max(1.0, spine_mm * mm)
    k = W / 230  # масштаб дрібних елементів задньої сторони
    mini = lambda c: f'<span class="block rounded-[2px] shadow-sm" style="width:{20*k:.0f}px;height:{30*k:.0f}px;background:{c}"></span>'
    back = f'''<div class="relative flex flex-col p-3" style="width:{W}px;height:{H}px;background:{bg};color:{sub};font-size:{8*k:.1f}px;line-height:1.4;gap:{6*k:.0f}px;padding:{12*k:.0f}px">
  <div class="flex items-center gap-2"><span class="shrink-0 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 ring-2" style="width:{36*k:.0f}px;height:{36*k:.0f}px;--tw-ring-color:{fg}"></span><b style="color:{fg};font-size:{11*k:.1f}px">e2e</b></div>
  <p><b style="color:{fg}">Про автора.</b> Авторка поезії та малої прози. Пише про Карпати, дорогу й людей.</p>
  <p><b style="color:{fg}">Про книгу.</b> Роман у віршах про двох людей, які вирушають у гори, щоб знайти одне одного.</p>
  <div><b style="color:{fg}">Інші книги автора на ULIT</b><div class="mt-1 flex gap-1.5">{mini("#047857")}{mini("#4338ca")}{mini("#b45309")}</div></div>
  <div class="mt-auto flex items-end justify-between"><span class="grid grid-cols-3 gap-px bg-white p-0.5" style="width:{28*k:.0f}px;height:{28*k:.0f}px">{"".join("<span class='bg-gray-900'></span>" if q in (0,2,4,6,8) else "<span></span>" for q in range(9))}</span><span class="flex items-stretch gap-[2px] bg-white p-0.5" style="width:{48*k:.0f}px;height:{24*k:.0f}px">{"".join(f"<span class='bg-gray-900' style='width:{x}px'></span>" for x in [1,2,1,1,3,1,2,1])}</span></div>
</div>'''
    g = ""
    if guides:
        bl = 3 * mm  # обріз 3 мм
        g = (f'<span class="pointer-events-none absolute inset-y-0 border-l border-dashed border-gray-900/70" style="left:{W:.1f}px"></span>'
             f'<span class="pointer-events-none absolute inset-y-0 border-l border-dashed border-gray-900/70" style="left:{W+sp:.1f}px"></span>'
             f'<span class="pointer-events-none absolute border border-dotted border-rose-500" style="inset:{bl:.1f}px"></span>')
    body = f'<div class="relative flex">{back}<div style="width:{sp:.1f}px;height:{H}px;background:{acc or fg}"></div>{cover_art(i, W)}{g}</div>'
    wrap = (f'<div class="rounded-[3px] bg-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.18)]" style="padding:{4*mm:.0f}px">{body}</div>' if hard
            else f'<div class="shadow-[0_4px_16px_rgba(0,0,0,0.18)] ring-1 ring-gray-200">{body}</div>')
    sm = f"{spine_mm:g}".replace(".", ",")
    cap = (f'<div class="mt-2 text-[12px] text-gray-500">Задня сторона — «Промо автора» · корінець {sm} мм · лицева'
           + (' · загин на картон' if hard else '') + '</div>') if caption else ""
    lab = ""
    if guides:
        pad = 4 * mm if hard else 0
        lab = (f'<div class="relative mb-1 flex text-center text-[11px] font-medium text-gray-500" style="padding:0 {pad:.0f}px">'
               f'<span style="width:{W}px">Задня сторона</span><span class="relative" style="width:{sp:.1f}px"><span class="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap">↓ корінець</span></span><span style="width:{W}px">Лицева</span></div>')
    return f'<div class="flex flex-col items-center">{lab}{wrap}{cap}</div>'

def auto_block(checklist=""):
    CUR = 6  # Текстури · квіти → «7 з 12» (перший стиль для жанру «Поезія»)
    LONG = "Дорога на Говерлу, або Чому ми досі не вміємо прощатися"
    fam = STYLES[CUR][0]
    chip = lambda name, n, on=False: f'<a class="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] {"bg-gray-900 font-medium text-white" if on else "border border-gray-300 bg-white text-gray-700"}">{name}<span class="{"text-white/60" if on else "text-gray-400"} text-[12px]">{n}</span></a>'
    chips_for = lambda fm: f'<div class="flex flex-wrap items-center gap-2">{chip("Усі",N)}' + "".join(chip(n, k, n == fm) for n, k in FAMILIES) + '</div>'
    seg = lambda on: f'''<div class="inline-flex rounded-lg bg-gray-100 p-1 text-[13px]"><a href="?state=auto" class="rounded-md px-3 py-1 {"bg-white font-medium shadow-sm" if on=="ebook" else "text-gray-600"}">Е-книга</a><a href="?state=auto&view=print" class="rounded-md px-3 py-1 {"bg-white font-medium shadow-sm" if on=="print" else "text-gray-600"}">Друк</a></div>'''
    arrow = lambda i, t: f'<button title="{t}" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm">{ic(i,"!w-5 !h-5")}</button>'
    strip_idx = list(range(2, 11))
    def thumb(i):
        on = i == CUR
        return f'<div class="flex flex-col items-center gap-1"><div class="overflow-hidden rounded {"ring-2 ring-green-600 ring-offset-2" if on else "ring-1 ring-gray-200"}">{cover_art(i, 46)}</div><span class="w-[58px] truncate text-center text-[10px] {"font-semibold text-gray-900" if on else "text-gray-500"}">{STYLES[i][1]}</span></div>'
    strip = '<div class="flex items-end justify-center gap-2.5">' + "".join(thumb(i) for i in strip_idx) + '</div>'

    genre_note = f'<div class="mt-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{ic("sparkles","!w-3 !h-3")}Підібрано за жанром «{GENRE}»</div>'
    def name_line(i):
        f, v = STYLES[i][0], STYLES[i][1]
        return f'<div class="text-center"><div class="text-[15px] font-semibold">{f} · {v}</div><div class="text-[12px] text-gray-500">{i+1} з {N}</div>{genre_note if i == CUR else ""}</div>'

    # друк: розворот у тому ж стилі (спільний рендер — print_spread)
    def spread(i):
        return print_spread(i, 230, 1.2)

    def preview(view, long=False):
        center = (f'<div class="shadow-[0_4px_16px_rgba(0,0,0,0.18)] ring-1 ring-gray-200">{cover_art(CUR if not long else 0, 250, title=LONG if long else "Назва книги", long=long)}</div>'
                  if view == "ebook" else spread(CUR))
        return f'<div class="flex items-center justify-center gap-6">{arrow("chevron-left","Попередній стиль")}{center}{arrow("chevron-right","Наступний стиль")}</div>'

    long_hint = f'''<div data-long="1" class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">{ic("triangle-alert","mt-0.5 !w-4 !h-4 shrink-0 text-amber-600")}<div><b class="font-medium">Назва довга — спробуйте Мінімал</b><div class="text-amber-800">У стилі «Класик · темна» вона не вміщується у верхній блок без зменшення шрифту.</div><button class="mt-1.5 inline-flex h-7 items-center rounded border border-amber-400 bg-white px-2 text-[12px] font-medium">Перейти до «Мінімал»</button></div></div>'''

    actions = f'''<div class="flex w-[280px] shrink-0 flex-col gap-3">
  <button class="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-green-600 px-4 text-[15px] font-medium text-white shadow-sm">{ic("check")}Підходить, використати</button>
  <a href="cover-editor.html?tab=ebook" class="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 text-[14px] font-medium">{ic("pencil")}Редагувати обкладинку</a>
  <button class="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-white px-4 text-[14px] font-medium text-gray-700">🎲 Інший варіант</button>
  {long_hint}
  <p class="text-[12px] text-gray-500">Кожен стиль — готовий: фон, блоки й колір тексту підібрано для контрасту й читабельності. Окремо налаштовувати кольори не потрібно — просто гортайте.</p>
  <div class="h-px bg-gray-100"></div>
  <a class="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 underline">{ic("upload","!w-4 !h-4")}Завантажити свою обкладинку (JPG/PNG)</a>
  {checklist}
</div>'''

    def card(view, long=False):
        return f'''<section class="rounded-xl border border-gray-200 p-5">
  <div class="flex items-center justify-between gap-4">{chips_for(STYLES[0][0] if long else fam)}{seg(view)}</div>
  <div class="mt-6 flex items-start gap-8">
    <div class="min-w-0 flex-1">{preview(view, long)}<div class="mt-3">{name_line(CUR if not long else 0)}</div>
      <div class="mt-4 border-t border-gray-100 pt-4">{strip}<div class="mt-2 text-center text-[11px] text-gray-400">Сусідні стилі · клікніть, щоб обрати</div></div></div>
    {actions}
  </div></section>'''

    note = f'''<div class="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/60 p-4">{ic("info","mt-0.5 shrink-0 text-green-700")}
<div class="text-[14px]"><div class="font-semibold text-green-900">Книга ще не опублікована — обраний стиль зберігається одразу</div>
<div class="mt-0.5 text-green-900/80">Без перевірки адміністратором. Ліміт «обкладинку можна змінювати раз на 90 днів» почне діяти лише після публікації.</div></div></div>'''
    sw = '''<div class="wf-only mb-4 flex flex-wrap items-center gap-2 text-[12px]"><span class="wf-note">WF · 06d:</span><a href="?state=auto" class="rounded border px-2 py-0.5">е-книга</a><a href="?state=auto&view=print" class="rounded border px-2 py-0.5">друк (розворот)</a><a href="?state=auto&long=1" class="rounded border px-2 py-0.5">довга назва → підказка</a></div>'''
    body = f'''{sw}{note}
<div class="mt-6">{h1("Обкладинка")}</div>
<p class="mt-1 text-[13px] text-gray-500">Ми вже зробили обкладинку з назвою й автором вашої книги. Гортайте готові стилі ‹ › або оберіть родину стилів.</p>
<div class="mt-4" data-view="ebook">{card("ebook")}</div>
<div class="mt-4" data-view="print">{card("print")}</div>
<div class="mt-4" data-view="long">{card("ebook", long=True)}</div>'''
    script = '''<script>(function(){const q=new URLSearchParams(location.search);if(q.get('state')!=='auto')return;
const v=q.get('long')==='1'?'long':(q.get('view')==='print'?'print':'ebook');
document.querySelectorAll('[data-view]').forEach(el=>{if(el.dataset.view!==v)el.remove();});
if(v!=='long')document.querySelectorAll('[data-long]').forEach(el=>el.remove());
document.querySelectorAll('aside span').forEach(s=>{if(s.textContent.trim()==='Опубліковано'){s.textContent='Чернетка';s.className='mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200';}});})();</script>'''
    return body, script
