# 08 Редактор обкладинки — підключається з build.py (exec), використовує ic(), HEAD, FOOT, FORMAT
def cover_editor():
    SEL = ""
    def handles():
        h = '<span class="absolute h-2.5 w-2.5 rounded-sm border-2 border-blue-500 bg-white" style="{}"></span>'
        pos = ["left:-7px;top:-7px","right:-7px;top:-7px","left:-7px;bottom:-7px","right:-7px;bottom:-7px","left:calc(50% - 5px);top:-7px","left:calc(50% - 5px);bottom:-7px"]
        return '<span class="pointer-events-none absolute z-10 rounded-sm border-2 border-blue-500" style="inset:-3px"></span>' + "".join(h.format(p) for p in pos)
    def sel_label(t, inside=False):
        pos = "top-1 left-1" if inside else "-top-7 left-[-4px]"
        return f'<span class="absolute z-20 {pos} whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 text-[11px] font-medium text-white">{t}</span>'
    LINK = ic("link","!w-3 !h-3 text-blue-600")
    def bound_chip(t="з даних книги"):
        return f'<span class="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-px text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">{ic("link","!w-2.5 !h-2.5")}{t}</span>'
    photo = lambda cls="": f'<div class="flex items-center justify-center bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-white/80 {cls}">{ic("image","!w-7 !h-7")}</div>'

    # ---------- front cover (shared by ebook and print)
    def front(selected=True, overlap=False):
        title_sel = f'{SEL}' if selected else ""
        rect_z = "z-30" if overlap else "z-0"
        rect_style = "top:30px;height:96px;left:0;right:0" if overlap else "top:0;height:150px;left:0;right:0"
        warn = f'''<div data-ov="1" class="absolute left-3 right-3 z-40 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[12px] text-amber-900 shadow" style="top:132px">
  <div class="flex items-start gap-1.5">{ic("triangle-alert","mt-0.5 !w-3.5 !h-3.5 shrink-0 text-amber-600")}<span class="font-medium">Фігура перекриває текст «Назва книги»</span></div>
  <button class="mt-1.5 inline-flex h-7 items-center gap-1 rounded border border-amber-400 bg-white px-2 text-[12px] font-medium">{ic("bring-to-front","!w-3.5 !h-3.5")}Перенести текст наверх</button></div>''' if overlap else ""
        return f'''<div class="relative h-full w-full overflow-visible bg-[#f5f5f4]">
  <div class="absolute {rect_z} {("bg-slate-800/90 "+SEL) if overlap else "bg-white"}" style="{rect_style}">{(handles()+sel_label("Прямокутник · фігура")) if overlap else ""}</div>
  <div class="absolute inset-x-0 top-[44px] z-20 flex justify-center"><div class="relative px-2 {title_sel}">{(handles()+sel_label("Назва книги · текст")) if selected else ""}<span class="text-[30px] font-bold tracking-tight">Назва книги</span></div></div>
  {photo("absolute inset-x-0 z-10") .replace('class="', 'style="top:150px;bottom:72px" class="',1)}
  <div class="absolute inset-x-0 bottom-[26px] z-20 text-center text-[15px] font-semibold text-gray-700">e2e</div>
  {warn}
</div>'''

    safe = lambda inset: f'<span class="pointer-events-none absolute z-40 border border-dashed border-sky-500/80" style="inset:{inset}px"></span>'
    trim = lambda inset: f'<span class="pointer-events-none absolute z-40 border border-dotted border-rose-500" style="inset:{inset}px"></span>'

    # ---------- ebook canvas
    def ebook_canvas(overlap=False):
        return f'''<div class="flex flex-col items-center">
  <div class="relative h-[492px] w-[320px] rounded-sm shadow-[0_2px_12px_rgba(0,0,0,0.15)] ring-1 ring-gray-200">{front(selected=not overlap, overlap=overlap)}{safe(24)}</div>
  <div class="mt-3 flex items-center gap-4 text-[12px] text-gray-600">
    <span class="inline-flex items-center gap-1.5"><span class="w-6 border-t border-dashed border-sky-500"></span>безпечна зона — текст і важливе всередині (10–15 мм від краю)</span></div>
  <p class="mt-1 text-[12px] text-gray-400">Клікніть на текст, щоб виділити його — навіть якщо під ним фігура.</p>
</div>'''

    # ---------- print spread (back | spine | front)
    def back_cover():
        mini = lambda t, c: f'<div class="flex flex-col items-center gap-1"><div class="flex h-[58px] w-[40px] items-end justify-center rounded-sm {c} p-1 text-[6px] font-bold leading-tight text-white shadow-sm">{t}</div><span class="w-[52px] truncate text-center text-[8px] text-gray-600">{t}</span></div>'
        blk = lambda inner, extra="": f'<div class="relative rounded border border-dashed border-transparent hover:border-blue-300 {extra}">{inner}</div>'
        return f'''<div class="relative h-full w-full bg-white {SEL}">{handles()}{sel_label("Задня сторона", inside=True)}
<div class="flex h-full flex-col gap-2.5 px-[26px] pb-[26px] pt-[30px] text-[9px] leading-snug text-gray-700">
  {blk(f'<div class="flex items-center gap-2.5"><div class="h-12 w-12 shrink-0 overflow-hidden rounded-full">{photo("h-full w-full")}</div><div><div class="text-[12px] font-bold text-gray-900">e2e</div><div class="mt-0.5">{bound_chip("Автори книги")}</div></div></div>')}
  {blk(f'<div class="mb-0.5 flex items-center gap-1 text-[8px] font-semibold text-gray-500">Про автора {bound_chip("Біографія")}</div><p>Авторка поезії та малої прози. Пише про Карпати, дорогу й людей, яких зустрічає. Учасниця літературних фестивалів, друкувалася в антологіях.</p>')}
  {blk(f'<div class="mb-0.5 flex items-center gap-1 text-[8px] font-semibold text-gray-500">Про книгу {bound_chip("Анотація")}</div><p>Роман у віршах про двох людей, які вирушають у гори, щоб знайти одне одного. Коротка анотація — перші ~300 символів з «Вихідних даних».</p>')}
  {blk(f'<div class="mb-1 flex items-center gap-1 text-[8px] font-semibold text-gray-500">Інші книги автора на ULIT {bound_chip("ULIT")}</div><div class="flex gap-2.5">{mini("Шлях на Говерлу","bg-emerald-700")}{mini("Тиша після дощу","bg-indigo-700")}{mini("Листи з полонини","bg-amber-700")}</div>')}
  {blk(f'<div class="mt-auto flex items-end justify-between"><div class="flex items-center gap-1.5"><div class="grid h-9 w-9 grid-cols-3 gap-px rounded-sm border border-gray-800 p-0.5">{"".join("<span class=bg-gray-800></span>" if i in (0,2,4,6,8) else "<span></span>" for i in range(9))}</div><span class="text-[8px] text-gray-500">ulit.render.ua/books/…</span></div><div class="flex h-7 w-14 items-stretch gap-[2px] rounded-sm border border-gray-300 bg-white p-0.5" title="Штрихкод ISBN">{"".join(f'<span class="bg-gray-900" style="width:{w}px"></span>' for w in [1,2,1,1,3,1,2,1,1,2,1,3,1,1])}</div></div>')}
</div></div>'''

    def spread(kind):
        spine_mm = "1,2" if kind == "soft" else "5,2"
        spine_px = 8 if kind == "soft" else 16
        note = ("Корінець 1,2 мм — текст можливий від 10 мм" if kind == "soft"
                else "Корінець 5,2 мм (тверда палітурка) — текст можливий від 10 мм")
        pad = "p-[10px] bg-slate-300" if kind == "hard" else ""
        return f'''<div class="flex flex-col items-center">
  <div class="relative rounded-sm shadow-[0_2px_12px_rgba(0,0,0,0.15)] {pad}">
   <div class="relative grid h-[440px] ring-1 ring-gray-200" style="grid-template-columns:286px {spine_px}px 286px">
    <div class="relative">{back_cover()}</div>
    <div class="relative z-30 bg-orange-400/70 ring-2 ring-orange-500"></div>
    <div class="relative overflow-hidden">{front(selected=False)}</div>
    {trim(6)}
    <span class="pointer-events-none absolute z-40 border border-dashed border-sky-500/80" style="top:24px;bottom:24px;left:24px;width:{286-48}px"></span>
    <span class="pointer-events-none absolute z-40 border border-dashed border-sky-500/80" style="top:24px;bottom:24px;right:24px;width:{286-48}px"></span>
   </div>
   <div class="absolute left-1/2 top-[-50px] z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-[12px] font-medium text-orange-900 shadow-sm">{ic("triangle-alert","mr-1 inline !w-3.5 !h-3.5 text-orange-600")}{note}<span class="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-orange-300"></span></div>
  </div>
  <div class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-gray-600">
    <span class="inline-flex items-center gap-1.5"><span class="w-6 border-t border-dashed border-sky-500"></span>безпечна зона (10–15 мм від краю)</span>
    <span class="inline-flex items-center gap-1.5"><span class="w-6 border-t border-dotted border-rose-500"></span>лінія обрізу — фон заводьте за неї</span>
    <span class="inline-flex items-center gap-1.5"><span class="h-3 w-2 bg-orange-400/70 ring-1 ring-orange-500"></span>корінець {spine_mm} мм</span>
    <span class="text-gray-400">· Задня · Корінець · Лицева</span></div>
</div>'''

    # ---------- layers panel
    def layer(name, icon, bound=False, sel=False, warn=False, indent=False):
        cls = "bg-blue-50 ring-1 ring-blue-300 font-medium" if sel else ("bg-amber-50 ring-1 ring-amber-300" if warn else "hover:bg-gray-50")
        return f'''<a class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] {cls} {'ml-3' if indent else ''}">{ic(icon,"!w-3.5 !h-3.5 shrink-0 text-gray-500")}<span class="min-w-0 flex-1 truncate">{name}</span>{LINK if bound else ""}{ic("triangle-alert","!w-3.5 !h-3.5 text-amber-600") if warn else ""}</a>'''
    def layers_ebook(overlap=False):
        rows = (layer("Прямокутник","square",warn=True) + layer("Назва книги","type",bound=True,warn=True)) if overlap else (layer("Назва книги","type",bound=True,sel=True) + layer("Автор","type",bound=True))
        rows += (layer("Автор","type",bound=True) if overlap else "") + layer("Ілюстрація","image") + ("" if overlap else layer("Прямокутник","square")) + layer("Фон","paint-bucket")
        w = f'''<div class="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[12px] text-amber-900">Фігура перекриває текст «Назва книги»<button class="mt-1 block font-medium underline">Перенести текст наверх</button></div>''' if overlap else ""
        return rows + w
    def layers_print():
        g = lambda t: f'<div class="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t}</div>'
        return (g("Задня сторона") + layer("Задня сторона · макет","layout-template",sel=True) +
                layer("Фото автора","circle-user",True,indent=True) + layer("Біографія","align-left",True,indent=True) +
                layer("Анотація","align-left",True,indent=True) + layer("Інші книги","library",True,indent=True) + layer("QR / посилання","qr-code",True,indent=True) +
                g("Корінець") + layer("Корінець · без тексту","columns-2") +
                g("Лицева сторона") + layer("Назва книги","type",True) + layer("Автор","type",True) + layer("Ілюстрація","image") + layer("Прямокутник","square") + layer("Фон","paint-bucket"))
    def layers_panel(body):
        return f'''<aside class="w-[220px] shrink-0 border-r border-gray-200 bg-[#fafafa] p-3">
  <div class="flex items-center justify-between px-1"><h2 class="text-[12px] font-semibold uppercase tracking-wide text-gray-500">Шари</h2><button class="inline-flex items-center gap-1 text-[12px] font-medium text-gray-700">{ic("plus","!w-3.5 !h-3.5")}Фігура</button></div>
  <div class="mt-2 space-y-0.5">{body}</div>
  <p class="mt-3 flex items-start gap-1 px-1 text-[11px] text-gray-500">{LINK}<span>— пов'язано з «Вихідними даними» / «Авторами книги», оновлюється автоматично</span></p>
</aside>'''

    # ---------- right sidebar
    def field(label, inner):
        return f'<div><div class="mb-1 text-[12px] font-medium text-gray-600">{label}</div>{inner}</div>'
    box = "flex h-9 items-center rounded-md border border-gray-300 bg-white px-2.5 text-[13px]"
    ibtn = lambda i, t, on=False: f'<button title="{t}" class="flex h-8 flex-1 items-center justify-center rounded-md border {"border-gray-900 bg-gray-900 text-white" if on else "border-gray-300 bg-white text-gray-700"}">{ic(i,"!w-4 !h-4")}</button>'
    def tabs(active):
        t = lambda k, l: f'<span class="flex-1 rounded-md py-1.5 text-center text-[13px] {"bg-white font-medium shadow-sm" if k==active else "text-gray-500"}">{l}</span>'
        return f'<div class="flex rounded-lg bg-gray-100 p-1">{t("sel","Вибране")}{t("design","Дизайн")}</div>'
    arrange = f'''{field("Вирівняти на обкладинці", f'<div class="flex gap-1.5">{ibtn("align-start-vertical","До лівої безпечної межі")}{ibtn("align-center-vertical","По центру")}{ibtn("align-end-vertical","До правої безпечної межі")}</div>')}
{field("Порядок шарів", f'<div class="flex gap-1.5">{ibtn("bring-to-front","На передній план")}{ibtn("arrow-up","Вище")}{ibtn("arrow-down","Нижче")}{ibtn("send-to-back","На задній план")}</div>')}'''
    sel_text = f'''<div class="space-y-3.5">
<div class="flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">{ic("type","!w-4 !h-4")}</span><div class="text-[14px] font-semibold">Назва книги · текст</div><span class="ml-auto">{bound_chip("Вихідні дані")}</span></div>
{field("Текст", f'<div class="{box} ring-2 ring-amber-300 border-amber-400">Назва книги: нове|</div>')}
<div class="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900">
  <div class="font-semibold">Відв'язати від Вихідних даних?</div>
  <div class="mt-0.5 text-amber-800">Назва на обкладинці перестане оновлюватися разом із «Вихідними даними».</div>
  <div class="mt-2 flex gap-1.5"><button class="h-7 rounded border border-amber-400 bg-white px-2 font-medium">Відв'язати й змінити</button><a href="output-data.html" class="inline-flex h-7 items-center rounded px-2 font-medium underline">Змінити у «Вихідних даних»</a></div>
</div>
<div class="grid grid-cols-[1fr_84px] gap-2">{field("Шрифт", f'<div class="{box} justify-between">Inter · Bold{ic("chevron-down","!w-3.5 !h-3.5 text-gray-400")}</div>')}{field("Розмір", f'<div class="{box} justify-between">32<span class="text-gray-400">pt</span></div>')}</div>
<div class="grid grid-cols-2 gap-2">{field("Колір", f'<div class="{box} gap-2"><span class="h-4 w-4 rounded border border-gray-300 bg-[#111]"></span>#111111</div>')}{field("Вирівнювання", f'<div class="flex gap-1">{ibtn("align-left","Ліворуч")}{ibtn("align-center","По центру",True)}{ibtn("align-right","Праворуч")}</div>')}</div>
{field("Прозорість", f'<div class="flex items-center gap-2"><div class="relative h-1.5 flex-1 rounded-full bg-gray-200"><div class="absolute inset-y-0 left-0 w-full rounded-full bg-gray-900"></div><span class="absolute -top-1 right-0 h-3.5 w-3.5 rounded-full border-2 border-gray-900 bg-white"></span></div><span class="w-10 text-right text-[13px]">100%</span></div>')}
<div class="h-px bg-gray-100"></div>
{arrange}
</div>'''
    sel_rect = f'''<div class="space-y-3.5">
<div class="flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-600">{ic("square","!w-4 !h-4")}</span><div class="text-[14px] font-semibold">Прямокутник · фігура</div><span class="ml-auto whitespace-nowrap text-[11px] text-gray-500">шаблон «Класик»</span></div>
<div class="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900"><div class="flex items-start gap-1.5 font-semibold">{ic("triangle-alert","mt-0.5 !w-3.5 !h-3.5 shrink-0 text-amber-600")}Фігура перекриває текст «Назва книги»</div>
<div class="mt-0.5 text-amber-800">Ви перемістили фігуру над текстом — назву не видно читачам.</div>
<button class="mt-2 inline-flex h-7 items-center gap-1 rounded border border-amber-400 bg-white px-2 font-medium">{ic("bring-to-front","!w-3.5 !h-3.5")}Перенести текст наверх</button></div>
<div class="grid grid-cols-2 gap-2">{field("Колір", f'<div class="{box} gap-2"><span class="h-4 w-4 rounded border border-gray-300 bg-[#1e293b]"></span>#1E293B</div>')}{field("Прозорість", f'<div class="{box} justify-between">90<span class="text-gray-400">%</span></div>')}</div>
<div class="h-px bg-gray-100"></div>
{arrange}
</div>'''
    def tog(label, on=True, hint="", bound=True):
        sw = (f'<span class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full {"bg-green-600" if on else "bg-gray-300"}"><span class="absolute {"right-0.5" if on else "left-0.5"} h-4 w-4 rounded-full bg-white shadow"></span></span>')
        return f'<label class="flex items-start gap-2.5 py-1.5 text-[13px]">{sw}<span class="min-w-0 flex-1"><span class="flex items-center gap-1.5 font-medium">{label}{LINK if bound else ""}</span>{('<span class="block text-[11px] text-gray-500">'+hint+'</span>') if hint else ""}</span></label>'
    sel_back = f'''<div class="space-y-3">
<div class="flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">{ic("layout-template","!w-4 !h-4")}</span><div class="text-[14px] font-semibold">Задня сторона · макет</div></div>
{field("Макет", f'<div class="{box} justify-between">Промо автора (за замовчуванням){ic("chevron-down","!w-3.5 !h-3.5 text-gray-400")}</div>')}
<div><div class="mb-0.5 text-[12px] font-medium text-gray-600">Задня сторона: що показувати</div>
{tog("Фото автора", hint="з «Авторів книги»")}
{tog("Біографія", hint="з «Авторів книги» · до 350 символів")}
{tog("Анотація", hint="коротка, з «Вихідних даних» · до 300 символів")}
{tog("Інші книги автора", hint="2–3 найпопулярніші на ULIT · немає інших книг — блок приховано")}
{tog("QR / посилання на книгу", hint="необов'язково · сторінка книги на ULIT")}
</div>
<p class="rounded-md bg-gray-50 p-2 text-[12px] text-gray-600">{LINK} Блоки оновлюються автоматично, коли змінюються дані книги чи автора. Щоб написати свій текст — клікніть блок і відв'яжіть його.</p>
<div class="h-px bg-gray-100"></div>
{arrange}
</div>'''
    def thumb(name, bg, title_cls, on=False):
        return f'''<a class="block"><div class="relative aspect-[13/20] overflow-hidden rounded-md {bg} {"ring-2 ring-green-600 ring-offset-1" if on else "ring-1 ring-gray-200"}">
<div class="absolute inset-x-0 top-[12%] text-center text-[9px] font-bold leading-tight {title_cls}">Назва книги</div>
{photo("absolute inset-x-[12%] top-[34%] h-[40%] rounded-sm")}
<div class="absolute inset-x-0 bottom-[8%] text-center text-[7px] {title_cls}">e2e</div>
{f'<span class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white">{ic("check","!w-2.5 !h-2.5")}</span>' if on else ""}</div>
<div class="mt-1 text-center text-[12px] {"font-medium" if on else "text-gray-600"}">{name}</div></a>'''
    sw = lambda c, on=False: f'<span class="h-7 w-7 rounded-md border {"ring-2 ring-green-600 ring-offset-1" if on else ""} border-gray-300" style="background:{c}"></span>'
    sec = lambda t, body, extra="": f'<section class="border-t border-gray-100 pt-3"><div class="mb-2 flex items-center justify-between text-[13px] font-semibold">{t}{extra}</div>{body}</section>'
    design = f'''<div class="space-y-3">
<section><div class="mb-2 flex items-center justify-between text-[13px] font-semibold">Шаблони<span class="text-[12px] font-normal text-gray-500">з вашою назвою та фото</span></div>
<div class="grid grid-cols-3 gap-2.5">{thumb("Класик","bg-[#f5f5f4]","text-gray-900",True)}{thumb("Мінімал","bg-white","text-gray-900")}{thumb("Яскравий","bg-rose-500","text-white")}{thumb("Елегант","bg-slate-900","text-amber-200")}{thumb("Природа","bg-emerald-700","text-white")}
<a class="flex aspect-[13/20] flex-col items-center justify-center rounded-md border border-dashed border-gray-300 text-center text-[12px] text-gray-600">{ic("layout-grid","!w-4 !h-4 mb-1")}Усі макети</a></div>
<p class="mt-1.5"><span class="wf-note">«Мої шаблони» з'являються тут лише після першого «Зберегти як шаблон»</span></p></section>
{sec("Ілюстрація", f'<div class="flex items-center gap-2"><button class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white text-[13px] font-medium">{ic("upload","!w-4 !h-4")}Завантажити ілюстрацію</button><div class="h-9 w-9 overflow-hidden rounded-md ring-2 ring-green-600">{photo("h-full w-full")}</div></div><div class="mt-1 text-[11px] text-gray-500">Раніше завантажені — праворуч</div>')}
{sec("Паттерн", f'<button class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white text-[13px] font-medium">{ic("shuffle","!w-4 !h-4")}Випадковий паттерн</button>')}
{sec("Фон", f'<div class="flex items-center gap-1.5">{sw("#f5f5f4",True)}{sw("#1e293b")}{sw("#0f172a")}{sw("#44403c")}{sw("#7f1d1d")}{sw("conic-gradient(red,yellow,lime,cyan,blue,magenta,red)")}</div><button class="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white text-[13px] font-medium">{ic("image","!w-4 !h-4")}Зображення для фону</button>')}
{sec("Своя обкладинка", f"""<p class="text-[12px] text-gray-600">Готова обкладинка цілком замінить макет. JPG/PNG, мінімум 768×1181 px; текст — не ближче 10–15 мм до краю.</p>
<div class="mt-2 rounded-md border-2 border-dashed border-gray-300 p-3 text-center text-[12px] text-gray-500">{ic("upload-cloud","mx-auto mb-1 !w-5 !h-5")}Перетягніть файл або <u>оберіть</u></div>
<div class="mt-2 space-y-1.5 text-[12px]">
 <div class="flex items-center gap-2 rounded-md bg-green-50 px-2 py-1.5 text-green-800 ring-1 ring-green-200">{ic("circle-check","!w-3.5 !h-3.5")}<span class="min-w-0 flex-1 truncate">cover.png · 1535×2362 px</span><b>підходить</b></div>
 <div class="flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-amber-800 ring-1 ring-amber-200">{ic("triangle-alert","!w-3.5 !h-3.5")}<span class="min-w-0 flex-1 truncate">800×1230 px — для друку може бути нечітко</span></div>
 <div class="flex items-center gap-2 rounded-md bg-red-50 px-2 py-1.5 text-red-700 ring-1 ring-red-200">{ic("circle-x","!w-3.5 !h-3.5")}<span class="min-w-0 flex-1 truncate">600×920 px — замало, мінімум 768×1181</span></div>
</div><p class="mt-1.5"><span class="wf-note">3 варіанти результату перевірки показано разом для WF; PSD-шаблони приховано, доки не готові</span></p>""", '<span class="text-[11px] font-normal text-gray-400">ebook · м\'яка · тверда</span>')}
</div>'''
    def right(active, body):
        return f'''<aside class="w-[340px] shrink-0 border-l border-gray-200 bg-white p-4">{tabs(active)}<div class="mt-4">{body}</div></aside>'''

    # ---------- top bar + bottom bar
    def topbar(active):
        t = lambda k, l: f'<a href="?tab={k}" class="rounded-md px-3 py-1.5 text-[13px] {"bg-white font-medium shadow-sm" if k==active else "text-gray-600"}">{l}</a>'
        return f'''<header class="flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4">
  <a href="cover.html" class="inline-flex items-center gap-1 text-[14px] text-gray-700">{ic("chevron-left")}Обкладинка</a>
  <div class="flex rounded-lg bg-gray-100 p-1">{t("ebook","Електронна версія")}{t("soft","М'яка обкладинка")}{t("hard","Тверда обкладинка")}</div>
  <span class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-600">{ic("ruler","!w-3.5 !h-3.5")}{FORMAT}</span>
  <a class="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3.5 text-[14px] font-medium">{ic("eye")}Передперегляд книги</a>
</header>'''
    def bottombar(fmt):
        return f'''<div class="sticky bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur">
  <div class="flex items-center gap-3">
    <button title="Скасувати дію" class="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white">{ic("undo-2")}</button>
    <button title="Повторити" disabled class="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-300">{ic("redo-2")}</button>
    <span class="text-[12px] text-gray-500">Збережеться як {fmt}</span>
    <div class="ml-auto flex items-center gap-3 whitespace-nowrap">
      <span class="inline-flex items-center gap-2 text-[13px] text-amber-700"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Є незбережені зміни</span>
      <span class="text-gray-300">·</span>
      <span class="inline-flex items-center gap-1 text-[13px] text-gray-600">{ic("clock","!w-3.5 !h-3.5 text-amber-600")}Книга опублікована: піде на затвердження · використовує ліміт 90 днів</span>
      <div class="relative"><button title="Зберегти як шаблон" class="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white">{ic("more-horizontal")}</button></div>
      <button class="inline-flex h-10 items-center gap-1.5 rounded-md bg-green-600 px-5 text-[14px] font-medium text-white shadow-sm">{ic("save")}Зберегти</button>
    </div>
  </div>
  <div class="wf-only mt-1 text-right"><span class="wf-note">⋯ → «Зберегти як шаблон» · «Скинути до шаблону»</span></div>
</div>'''

    def screen(tab, center, layers, side_active, side_body, fmt, extra=""):
        return f'''<div data-tab="{tab}" class="flex min-h-screen flex-col bg-white">
{topbar(tab.split()[0])}
<div class="flex flex-1">
{layers_panel(layers)}
<main class="flex min-w-0 flex-1 flex-col items-center bg-gray-50 px-6 pb-8 pt-{'16' if tab!='ebook' else '8'}">{extra}{center}</main>
{right(side_active, side_body)}
</div>
{bottombar(fmt)}
</div>'''
    wf = '''<div class="wf-only mb-3 flex flex-wrap items-center gap-2 self-stretch text-[12px]"><span class="wf-note">WF · стан:</span><a href="?tab=ebook" class="rounded border bg-white px-2 py-0.5">ebook · виділено назву</a><a href="?tab=ebook&panel=design" class="rounded border bg-white px-2 py-0.5">ebook · Дизайн</a><a href="?tab=ebook&overlap=1" class="rounded border bg-white px-2 py-0.5">фігура перекриває текст</a><a href="?tab=soft" class="rounded border bg-white px-2 py-0.5">м'яка · задня сторона</a><a href="?tab=hard" class="rounded border bg-white px-2 py-0.5">тверда</a></div>'''
    PNG_E = "PNG 1535×2362 px (300 DPI)"
    PNG_P = "PNG-розворот (300 DPI)"
    html = (
        screen("ebook", ebook_canvas(), layers_ebook(), "sel", sel_text, PNG_E, wf).replace('data-tab="ebook"', 'data-tab="ebook" data-v="sel"') +
        screen("ebook", ebook_canvas(), layers_ebook(), "design", design, PNG_E, wf).replace('data-tab="ebook"', 'data-tab="ebook" data-v="design"') +
        screen("ebook", ebook_canvas(overlap=True), layers_ebook(True), "sel",
               sel_rect, PNG_E, wf).replace('data-tab="ebook"', 'data-tab="ebook" data-v="overlap"') +
        screen("soft", spread("soft"), layers_print(), "sel", sel_back, PNG_P, wf) +
        screen("hard", spread("hard"), layers_print(), "sel", sel_back, PNG_P, wf))
    script = '''<script>(function(){const q=new URLSearchParams(location.search);const t=q.get('tab')||'ebook';
const v=q.get('overlap')==='1'?'overlap':(q.get('panel')==='design'?'design':'sel');
document.querySelectorAll('[data-tab]').forEach(el=>{const ok=el.dataset.tab===t&&(!el.dataset.v||el.dataset.v===v);if(!ok)el.remove();});})();</script>'''
    return HEAD.format(title="ULIT — Редактор обкладинки (WF)") + html + script + FOOT
