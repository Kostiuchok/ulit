# Генератор статичних HTML-вайрфреймів (спільні сайдбар/топбар). Запуск: python3 build.py
import pathlib
OUT = pathlib.Path(__file__).parent

HEAD = """<!doctype html>
<html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
<style>
  body{{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;color:#0a0a0a}}
  .wf-note{{font-size:11px;color:#7c3aed;background:#f5f3ff;border:1px dashed #c4b5fd;border-radius:6px;padding:2px 6px}}
  [data-lucide]{{width:16px;height:16px;stroke-width:2}}
  details>summary{{list-style:none}} details>summary::-webkit-details-marker{{display:none}}
  details[open] .chev{{transform:rotate(180deg)}}
  .clean .wf-only{{display:none!important}}
</style></head>
<body class="bg-white">
"""

FOOT = """<script>
  const q=new URLSearchParams(location.search);
  if(q.get('static')==='1')document.querySelectorAll('.sticky').forEach(e=>{e.classList.remove('sticky');});
  if(q.get('clean')==='1')document.body.classList.add('clean');
  document.querySelectorAll('[data-state]').forEach(el=>{
    const want=el.dataset.state, cur=q.get('state')||el.dataset.default;
    el.style.display = (want.split(' ').includes(cur))?'':'none';
  });
  lucide.createIcons();
</script></body></html>"""

def ic(name, cls=""):
    return f'<i data-lucide="{name}" class="{cls}"></i>'

def sidebar(active):
    def item(icon, label, key, href="#"):
        on = key == active
        base = "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[14px]"
        st = "bg-gray-100 font-medium text-black" if on else "text-gray-800 hover:bg-gray-50"
        return f'<a href="{href}" class="{base} {st}">{ic(icon,"shrink-0 text-gray-500")}<span>{label}</span></a>'
    def group(title, items):
        return f'''<div class="mt-3"><div class="flex items-center gap-1.5 px-2.5 pb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500">{title}</div>{"".join(items)}</div>'''
    return f'''
<aside class="flex w-[264px] shrink-0 flex-col border-r border-gray-200 bg-[#fafafa]">
  <div class="p-3"><button class="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2.5 text-[14px] font-medium text-white shadow-sm">{ic("plus")}Створити нову книжку</button></div>
  <div class="mx-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5">
    <div class="h-12 w-9 shrink-0 rounded-sm bg-gradient-to-b from-slate-300 to-slate-500"></div>
    <div class="min-w-0"><div class="text-[15px] font-semibold leading-tight">Назва книги</div>
      <span class="mt-1 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-200">Опубліковано</span></div>
    {ic("chevrons-up-down","ml-auto text-gray-400")}
  </div>
  <nav class="flex-1 px-2 pt-1">
    {group("Редагувати книгу",[item("info","Вихідні дані","output","output-data.html"),item("file-text","Рукопис","ms"),item("image","Обкладинка","cover","cover.html"),item("eye","Перегляд книги","preview"),item("trash-2","Видалити книгу","del")])}
    {group("У магазинах",[item("store","Публікація","pub","dashboard.html")])}
    {group("Реклама",[item("package","Замовити тираж","print")])}
  </nav>
  <details class="mx-2 mb-2 rounded-md border border-dashed border-gray-300 bg-white">
    <summary class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[13px] text-gray-500">{ic("clock","text-gray-400")}<span>Скоро: ще 4 розділи</span>{ic("chevron-down","chev ml-auto text-gray-400 transition")}</summary>
    <div class="space-y-0.5 px-2.5 pb-2 text-[13px] text-gray-400">
      <div class="flex items-center gap-2 py-1">{ic("bar-chart-3")}Статистика</div>
      <div class="flex items-center gap-2 py-1">{ic("download")}Завантаження</div>
      <div class="flex items-center gap-2 py-1">{ic("message-square")}Обговорення</div>
      <div class="flex items-center gap-2 py-1">{ic("users")}Знайти читачів</div>
    </div>
  </details>
  <div class="flex items-center gap-3 border-t border-gray-200 p-3">
    <div class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-[13px] font-semibold">E</div>
    <div class="leading-tight"><div class="text-[14px] font-medium">e2e</div><div class="text-[12px] text-gray-500">e2e@render.ua</div></div>
    {ic("chevrons-up-down","ml-auto text-gray-400")}
  </div>
</aside>'''

TOPBAR = f'''<header class="flex h-12 items-center justify-between border-b border-gray-200 px-4">
  {ic("panel-left","text-gray-600")}
  <div class="flex items-center gap-3 text-[13px]"><a class="text-gray-600">На сайт</a>
    <div class="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5"><b>A−</b><span class="text-gray-500">100%</span><b>A+</b></div>
    {ic("bell","text-gray-700")}</div>
</header>'''

def page(title, active, main, extra_after_main=""):
    return HEAD.format(title=title) + f'''
<div class="flex min-h-screen">
{sidebar(active)}
<div class="relative flex min-w-0 flex-1 flex-col">
{TOPBAR}
{main}
{extra_after_main}
</div></div>''' + FOOT

# ---------------------------------------------------------------- DASHBOARD
def step(done, label, date="", sub=None, extra="", current=False, link=False):
    if current:
        dot = '<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-green-600 bg-white"><span class="h-2 w-2 rounded-full bg-green-600"></span></span>'
    else:
        dot = '<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"><i data-lucide="check" style="width:12px;height:12px;stroke-width:3"></i></span>'
    lab = f'<span class="{"underline" if link else ""} font-medium {"text-black" if current else "text-green-700"}">{label}</span>'
    d = f'<span class="text-gray-500"> · {date}</span>' if date else ""
    subs = ""
    if sub:
        subs = '<ul class="mt-1 space-y-0.5 text-[13px]">' + "".join(
            f'<li class="flex items-center gap-1.5 {c}">{t}</li>' for t, c in sub) + "</ul>"
    return f'<li class="flex gap-3 py-1.5">{dot}<div class="min-w-0 text-[14px]">{lab}{d}{extra}{subs}</div></li>'

OK = '<i data-lucide="check" class="text-green-600" style="width:13px;height:13px"></i>'

def steps_full():
    s1 = [(OK+"Основну інформацію заповнено","text-gray-700"),(OK+"Рукопис завантажено <span class='text-gray-400'>· 03.10.2026</span>","text-gray-700"),
          (OK+"Ціну встановлено","text-gray-700"),(OK+"Обкладинку додано","text-gray-700"),(OK+"Платформи розповсюдження обрано","text-gray-700"),
          (OK+"Огляд перед публікацією пройдено","text-gray-700"),
          ('<i data-lucide="circle-dashed" class="text-gray-400" style="width:13px;height:13px"></i>Отримати УДК <span class="ml-1 rounded-full bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">в процесі</span><span class="ml-1 rounded-full bg-gray-100 px-1.5 py-px text-[11px] text-gray-600">необов\'язково</span>',"text-gray-700")]
    s2 = [(OK+"Вихідні дані заповнено","text-gray-700"),(OK+"Магазини та розмір роялті обрано","text-gray-700")]
    return "".join([
        step(True,"Книгу створено","03.10.2026",s1),
        step(True,"Надіслано на публікацію","03.10.2026",s2),
        step(True,"Перевірку завершено","03.10.2026"),
        step(True,"Договір укладено","01.10.2026",link=True),
    ])

def dashboard():
    header = f'''
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <div class="flex items-center gap-3"><h1 class="text-[23px] font-bold">Назва книги</h1>
        <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[12px] font-medium text-green-700 ring-1 ring-green-200">{ic("circle-check","!w-3.5 !h-3.5")}Опубліковано</span></div>
      <p class="mt-1 text-[13px] text-gray-500">Остання публікація: 03.10.2026 · <span data-state="changes" data-default="published" class="font-medium text-amber-700">є неопубліковані зміни</span><span data-state="published menu" data-default="published">усі зміни опубліковано</span></p>
    </div>
    <div class="relative flex items-center gap-2">
      <a href="output-data.html" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-black bg-white px-3.5 text-[14px] font-medium">{ic("pencil")}Редагувати</a>
      <a data-state="published menu" data-default="published" class="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-600 px-3.5 text-[14px] font-medium text-white shadow-sm">{ic("external-link")}Сайт книги</a>
      <a data-state="changes" data-default="published" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-black bg-white px-3.5 text-[14px] font-medium">{ic("external-link")}Сайт книги</a>
      <button data-state="changes" data-default="published" class="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-600 px-3.5 text-[14px] font-medium text-white shadow-sm">{ic("upload-cloud")}Опублікувати зміни<span class="ml-0.5 rounded-full bg-white/25 px-1.5 text-[11px]">2</span></button>
      <button class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white {'' }" aria-label="Більше дій">{ic("more-horizontal")}</button>
      <div data-state="menu" data-default="published" class="absolute right-0 top-11 z-20 w-72 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
        <a class="flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] hover:bg-gray-50">{ic("link","text-gray-500")}Копіювати посилання на книгу</a>
        <a class="flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] hover:bg-gray-50">{ic("history","text-gray-500")}Історія публікацій</a>
        <div class="my-1 h-px bg-gray-100"></div>
        <a class="flex items-start gap-2.5 rounded-md px-3 py-2 text-[14px] text-red-600 hover:bg-red-50">{ic("eye-off","mt-0.5")}<span>Зняти з публікації<span class="block text-[12px] text-red-500/80">Книга зникне з магазинів і сайту. Потрібне підтвердження.</span></span></a>
      </div>
    </div>
  </div>'''

    changes_banner = f'''
  <div data-state="changes" data-default="published" class="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
    {ic("alert-triangle","mt-0.5 shrink-0 text-amber-600")}
    <div class="text-[14px]"><div class="font-semibold text-amber-900">Є неопубліковані зміни: Вихідні дані, Ціна</div>
      <div class="mt-0.5 text-amber-800">Після «Опублікувати зміни» книга піде на повторну модерацію. До схвалення в магазинах лишається поточна версія.</div></div>
    <a class="ml-auto shrink-0 text-[13px] font-medium text-amber-900 underline">Що змінилось?</a>
  </div>'''

    next_step = f'''
  <section class="mt-5 flex items-center gap-4 rounded-xl border border-green-200 bg-green-50/60 p-5">
    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">{ic("store","!w-5 !h-5")}</div>
    <div class="min-w-0 flex-1">
      <div class="text-[12px] font-semibold uppercase tracking-wide text-green-700">Наступний крок · 13 з 13</div>
      <div class="text-[17px] font-bold">Публікація у магазинах</div>
      <p class="mt-0.5 text-[13px] text-gray-700">Ми передаємо книгу в Amazon, Google Play, Apple Books та інші магазини. Зазвичай це 3–10 робочих днів — статус кожного магазину видно на сторінці публікації.</p>
    </div>
    <a class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-green-600 px-4 text-[14px] font-medium text-white shadow-sm">Переглянути публікацію{ic("arrow-right")}</a>
  </section>'''

    cover = f'''
    <div>
      <div class="mx-auto flex aspect-[2/3] w-full max-w-[220px] flex-col items-center justify-between overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-b from-slate-100 to-slate-300 p-4 shadow-sm">
        <div class="pt-3 text-center text-[18px] font-bold">Назва книги</div>
        <div class="flex h-28 w-full items-center justify-center rounded bg-slate-400/40 text-slate-600">{ic("image","!w-8 !h-8")}</div>
        <div class="text-[12px] text-gray-700">e2e</div>
      </div>
      <div class="mt-2 flex justify-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-black"></span><span class="h-1.5 w-1.5 rounded-full bg-gray-300"></span><span class="h-1.5 w-1.5 rounded-full bg-gray-300"></span></div>
      <a class="mt-2 block text-center text-[13px] text-gray-600 underline">Попередній перегляд</a>
    </div>'''

    prices = f'''
      <div class="rounded-xl border border-gray-200 p-4">
        <div class="flex items-center justify-between"><h2 class="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Ціни</h2>
          <a class="inline-flex items-center gap-1 text-[13px] font-medium underline">{ic("pencil","!w-3.5 !h-3.5")}Змінити ціну</a></div>
        <div class="mt-2 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-gray-50 px-2 py-2"><div class="text-[12px] text-gray-500">Електронна</div><div class="text-[16px] font-semibold">143 грн</div></div>
          <div class="rounded-lg bg-gray-50 px-2 py-2"><div class="text-[12px] text-gray-500">Друк, м'яка</div><div class="text-[16px] font-semibold">374 грн</div></div>
          <div class="rounded-lg bg-gray-50 px-2 py-2"><div class="text-[12px] text-gray-500">Друк, тверда</div><div class="text-[16px] font-semibold">517 грн</div></div>
        </div>
      </div>'''

    status = f'''
    <div class="min-w-0 space-y-4">
      <div class="flex items-center justify-between"><h2 class="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Статус книжки</h2>
        <span class="inline-flex items-center gap-1 text-[13px] font-medium text-green-700">{ic("circle-check","!w-3.5 !h-3.5")}Опубліковано</span></div>
      {prices}
      <div class="rounded-xl border border-gray-200">
        <details data-state="published menu" data-default="published" class="group">
          <summary class="flex cursor-pointer items-center gap-3 p-4">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">{ic("check","!w-3.5 !h-3.5")}</span>
            <span class="text-[15px] font-semibold">12 з 13 кроків виконано</span>
            <span class="ml-auto inline-flex items-center gap-1 text-[13px] text-gray-500">Показати{ic("chevron-down","chev transition")}</span>
          </summary>
          <ol class="border-t border-gray-100 px-4 py-2">{steps_full()}</ol>
        </details>
        <div data-state="changes" data-default="published">
          <div class="flex items-center gap-3 p-4 pb-1">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">{ic("check","!w-3.5 !h-3.5")}</span>
            <span class="text-[15px] font-semibold">12 з 13 кроків виконано</span>
            <span class="ml-auto inline-flex items-center gap-1 text-[13px] text-gray-500">Згорнути{ic("chevron-up")}</span>
          </div>
          <ol class="px-4 pb-1">{steps_full()}</ol>
        </div>
        <div class="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-600"><span class="h-2 w-2 rounded-full bg-green-600"></span></span>
          <span class="text-[14px] font-medium">Публікація у магазинах</span>
          <span class="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">в процесі</span>
        </div>
      </div>
    </div>'''

    def svc(name, price, icon):
        return f'''<a class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-gray-400">{ic(icon,"text-green-700")}<span class="whitespace-nowrap text-[14px] font-medium">{name}</span><span class="ml-auto whitespace-nowrap text-[12px] text-gray-600">від {price} ₴</span>{ic("chevron-right","text-gray-400")}</a>'''

    better = f'''
    <aside class="min-w-0">
      <h2 class="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Зробіть книгу кращою</h2>
      <div class="mt-3 rounded-xl border border-green-200 bg-green-50/50 p-3">
        <div class="flex items-center gap-2 text-[14px] font-semibold">{ic("megaphone","text-green-700")}Просування книги</div>
        <p class="mt-1 text-[12px] text-gray-600">Книга вже в продажу — час розповісти про неї читачам.</p>
        <a class="mt-2 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">{ic("sparkles","text-green-700")}<span class="text-[14px] font-medium">Про-акаунт</span><span class="ml-auto text-[12px] text-gray-600">від 2 700 ₴</span>{ic("chevron-right","text-gray-400")}</a>
      </div>
      <div class="mt-4 text-[12px] font-semibold uppercase tracking-wide text-gray-500">Для нового видання</div>
      <div class="mt-2 space-y-2">
        {svc("Редактура","5 200","spell-check")}
        {svc("Коректура","2 500","check-check")}
        {svc("Проста верстка","1 990","layout-template")}
        {svc("Дизайн обкладинки","4 800","palette")}
      </div>
      <details class="mt-3 rounded-lg border border-dashed border-gray-300">
        <summary class="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[13px] text-gray-600">{ic("clock","shrink-0 text-gray-400")}<span><b class="font-medium">Скоро:</b> тираж, аудіокнига, офлайн-продаж, просування, буктрейлер</span>{ic("chevron-down","chev ml-auto shrink-0 text-gray-400 transition")}</summary>
        <div class="px-3 pb-3 text-[12px] text-gray-500">Ми повідомимо, коли послуги з'являться. <a class="underline">Повідомити мене</a></div>
      </details>
      <a class="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-green-700 underline">Усі послуги{ic("arrow-right")}</a>
    </aside>'''

    main = f'''
<main class="flex-1 px-8 py-6">
  <div class="wf-only mb-4 flex items-center gap-2 text-[12px]"><span class="wf-note">WF · стан:</span>
    <a href="?state=published" class="rounded border px-2 py-0.5">опубліковано</a>
    <a href="?state=changes" class="rounded border px-2 py-0.5">є неопубліковані зміни</a>
    <a href="?state=menu" class="rounded border px-2 py-0.5">меню «⋯»</a></div>
  {header}
  {changes_banner}
  {next_step}
  <div class="mt-6 grid grid-cols-[180px_minmax(0,1fr)_300px] gap-6">
    {cover}
    {status}
    {better}
  </div>
</main>'''
    return page("ULIT — Дашборд книги (WF)", "pub", main)

# ---------------------------------------------------------------- OUTPUT DATA
# Підсвітка (лише у стані dirty): amber = змінено, не збережено; red = помилка валідації
HL = {
    "amber": dict(box="border-amber-400 ring-1 ring-amber-400", card="border-2 border-amber-400"),
    "red":   dict(box="border-red-500 ring-1 ring-red-500",     card="border-2 border-red-500"),
}
def hl_attr(kind, part, off):
    """Атрибути, що в стані dirty міняють класи `off` на підсвітку `kind`."""
    if not kind: return f'class="{off}"'
    return f'data-hl="dirty" data-default="dirty" data-hl-on="{HL[kind][part]}" data-hl-off="{off}" class="{off}"'

def field_note(kind):
    if kind == "amber":
        return '<span data-state="dirty" data-default="dirty" class="ml-2 rounded bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">змінено</span>'
    return ""

def inp(label, val="", ph="", req=False, helper="", counter="", cls="", hl=None, err=""):
    star = '<span class="text-red-500"> *</span>' if req else ""
    cnt = f'<span class="text-[12px] text-gray-400">{counter}</span>' if counter else ""
    v = f'<span>{val}</span>' if val else f'<span class="text-gray-400">{ph}</span>'
    h = f'<p class="mt-1 text-[12px] text-gray-500">{helper}</p>' if helper else ""
    e = f'<p data-state="dirty" data-default="dirty" class="mt-1 flex items-center gap-1 text-[12px] font-medium text-red-600">{ic("circle-alert","!w-3.5 !h-3.5")}{err}</p>' if err else ""
    box = hl_attr(hl, "box", "border-gray-200")
    return f'''<div class="{cls}"><div class="mb-1.5 flex items-end justify-between"><label class="text-[14px] font-medium">{label}{star}{field_note(hl)}</label>{cnt}</div>
<div {box[:-1]} flex h-10 items-center rounded-md border bg-white px-3 text-[14px]">{v}</div>{h}{e}</div>'''

def sel(label, val, req=True, helper=""):
    star = '<span class="text-red-500"> *</span>' if req else ""
    h = f'<p class="mt-1 flex items-center gap-1 text-[12px] text-gray-500">{helper}</p>' if helper else ""
    return f'''<div><label class="mb-1.5 block text-[14px] font-medium">{label}{star}</label>
<div class="flex h-10 items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[14px]"><span>{val}</span>{ic("chevron-down","text-gray-500")}</div>{h}</div>'''

def card_badge(kind, text):
    """Бейдж у шапці картки (лише dirty)."""
    if kind == "amber":
        c, i = "bg-amber-50 text-amber-800 ring-amber-300", "pencil"
    else:
        c, i = "bg-red-50 text-red-700 ring-red-300", "circle-alert"
    return f'<span data-state="dirty" data-default="dirty" class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 {c}">{ic(i,"!w-3 !h-3")}{text}</span>'

def section(title, desc, body, req=False, hl=None, badge="", sid=""):
    star = '<span class="text-red-500"> *</span>' if req else ""
    attrs = hl_attr(hl, "card", "border border-gray-200")
    idattr = f' id="{sid}"' if sid else ""
    b = card_badge(hl, badge) if hl else ""
    return f'''<section{idattr} {attrs[:-1]} scroll-mt-20 rounded-xl p-5">
<div class="flex items-start justify-between gap-3"><div><h2 class="text-[16px] font-bold">{title}{star}</h2><p class="mt-0.5 text-[13px] text-gray-500">{desc}</p></div><div class="flex items-center gap-2">{b}{ic("chevron-up","text-gray-400")}</div></div>
<div class="mt-4">{body}</div></section>'''

HL_SCRIPT = """<script>
  // data-hl="dirty": у вказаних станах класи data-hl-off замінюються на data-hl-on (підсвітка блоків/полів)
  (()=>{const q=new URLSearchParams(location.search);
  document.querySelectorAll('[data-hl]').forEach(el=>{
    const on=el.dataset.hl.split(' ').includes(q.get('state')||el.dataset.default);
    const add=(on?el.dataset.hlOn:el.dataset.hlOff)||'', rm=(on?el.dataset.hlOff:el.dataset.hlOn)||'';
    rm.split(' ').filter(Boolean).forEach(c=>el.classList.remove(c));
    add.split(' ').filter(Boolean).forEach(c=>el.classList.add(c));
  });})();
</script>"""

# Степер «Вихідні дані → … → Публікація» (спільний для 03, 05–07); пункти — посилання на сторінки WF
STEPS = [("Вихідні дані","output-data.html"),("Рукопис","#"),("Обкладинка","cover.html"),
         ("Ціна та розповсюдження","price.html"),("Огляд перед публікацією","review.html"),("Публікація","dashboard.html")]
def stepper_bar(active):
    return '<div class="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-200 bg-white px-8 py-2.5">' + "".join(
        (f'<a href="{h}" class="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-[13px] font-medium text-white">{ic("circle-check","text-green-400 !w-3.5 !h-3.5")}{s}</a>' if i==active else
         f'<a href="{h}" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-600 hover:text-black">{ic("circle-check","text-green-600 !w-3.5 !h-3.5")}{s}</a>')
        for i, (s, h) in enumerate(STEPS)) + "</div>"

PUBLISHED_BANNER = f'''<div class="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
  {ic("info","mt-0.5 shrink-0 text-blue-600")}
  <div class="text-[14px]"><div class="font-semibold text-blue-900">Книга вже опублікована</div>
  <div class="mt-0.5 text-blue-900/80">Збережені зміни не потрапляють у магазини одразу. Щоб їх оприлюднити, натисніть «Опублікувати зміни» на дашборді книги — книга піде на повторну модерацію, а до схвалення в магазинах лишиться поточна версія.</div></div>
  <a href="dashboard.html?state=changes" class="ml-auto shrink-0 whitespace-nowrap text-[13px] font-medium text-blue-900 underline">До дашборду книги</a>
</div>'''

def output_data():
    stepper = stepper_bar(0)

    marks = [(50,"D2D"),(120,"УДК"),(150,"Google Play"),(250,"Amazon KDP")]
    cur = 257
    tick = "".join(f'''<div class="absolute top-0 flex -translate-x-1/2 flex-col items-center" style="left:{m/500*100}%">
<span class="h-3 w-0.5 {'bg-green-600' if cur>=m else 'bg-gray-300'}"></span>
<span class="mt-0.5 whitespace-nowrap text-[11px] font-medium {'text-green-700' if cur>=m else 'text-gray-500'}">{m}</span></div>''' for m, n in marks)
    legend = "".join(f'''<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 {'bg-green-50 text-green-700 ring-green-200' if cur>=m else 'bg-gray-50 text-gray-500 ring-gray-200'}">{'✓' if cur>=m else '○'} {n} · {m}+</span>''' for m, n in marks)
    scale = f'''<div class="mt-2">
  <div class="relative h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full bg-green-500" style="width:{cur/500*100}%"></div></div>
  <div class="relative h-7">{tick}<div class="absolute right-0 top-0 flex flex-col items-end"><span class="h-3 w-0.5 bg-gray-300"></span><span class="mt-0.5 text-[11px] text-gray-500">500 макс.</span></div></div>
  <div class="flex flex-wrap gap-1.5">{legend}</div>
</div>'''

    annot = f'''<div><div class="mb-1.5 flex items-end justify-between"><label class="text-[14px] font-medium">Анотація<span class="text-red-500"> *</span>{field_note("amber")}</label><span class="text-[12px] text-gray-600"><b class="text-green-700">257</b> / 500 · мінімум 120</span></div>
<div {hl_attr("amber","box","border-gray-200")[:-1]} h-32 rounded-md border px-3 py-2 text-[14px] leading-relaxed text-gray-800">Анотація до книги має бути такої довжини, щоб читач зрозумів, про що книга, і захотів її відкрити. Розкажіть про головного героя, конфлікт і атмосферу…</div>
{scale}
<p class="mt-1.5 text-[12px] text-gray-500">Позначки — мінімальна довжина для кожного магазину. Зелені — вимогу виконано.</p></div>'''

    decl = f'''<div class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
  <div class="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Декларації</div>
  <label class="mt-2 flex items-start gap-2.5 text-[14px]"><span class="mt-0.5 h-4 w-4 shrink-0 rounded border border-gray-400 bg-white"></span>
  <span>Текст (або обкладинку) частково/повністю створено за допомогою ШІ<span class="block text-[12px] text-gray-500">Деякі магазини (Amazon KDP, Google Play) вимагають позначати такий контент.</span></span></label>
</div>'''

    left = f'''<div class="space-y-5">{inp("Назва","Назва книги",req=True,counter="11/255")}{inp("Підзаголовок","Роман у віршах",ph="Наприклад: збірка оповідань",hl="amber")}{annot}{decl}</div>'''
    right = f'''<div class="space-y-5">{sel("Жанр","Поезія")}
{sel("Розмір книги","Стандартний (130×200 мм)",helper=ic("ruler","!w-3.5 !h-3.5")+"Друкована версія матиме розмір <b class='mx-1 text-gray-700'>130×200 мм</b>")}
{sel("Мова книги","🇺🇦 Українська",helper=ic("info","!w-3.5 !h-3.5")+"Потрібна для Amazon, Google Play")}
{sel("Вікові обмеження","18+")}</div>'''

    authors = section("Автори книги","Якщо авторів декілька — кожен додає власне прізвище/ім'я і, за бажанням, своє фото.", f'''
<div class="flex items-center gap-1.5 text-[12px] text-green-700">{ic("check","!w-3.5 !h-3.5")}Автора вказано</div>
<div class="mt-2 flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2"><span class="h-7 w-7 rounded-full bg-slate-400"></span><span class="text-[14px] font-medium">Тестовий Тест Тестович</span>{ic("x","ml-auto text-gray-400")}</div>
<div class="mt-3 grid grid-cols-3 gap-3">{inp("Прізвище","Тестовий",req=True)}{inp("Ім'я","Тест",req=True)}{inp("По батькові","Тестович")}</div>
<div class="mt-3 flex items-end gap-2"><div class="flex-1">{inp("Фото автора",ph="URL фото (необов'язково)")}</div><button class="inline-flex h-10 items-center gap-1.5 rounded-md border border-gray-300 px-3 text-[13px] font-medium">{ic("upload")}Завантажити фото</button></div>
<div class="mt-3"><label class="mb-1.5 block text-[14px] font-medium">Біографія автора<span class="text-red-500"> *</span>{field_note("amber")}</label>
<div {hl_attr("amber","box","border-gray-200")[:-1]} h-20 rounded-md border px-3 py-2 text-[14px] text-gray-800">Це моя біографія на декілька речень: пишу казки і поезію, інколи вірші й наукові праці…</div></div>
<button class="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-3 text-[13px] font-medium">{ic("plus")}Додати автора</button>''', req=True, hl="amber", badge="Змінено · 1 поле", sid="blk-authors")

    team = section("Над книгою працювали","Редактор, ілюстратор, дизайнер обкладинки тощо.", f'''
<div class="flex items-end gap-2"><div class="w-56">{inp("Роль",ph="Напр. редактор")}</div><div class="flex-1">{inp("Ім'я",ph="Ім'я та прізвище")}</div><button class="inline-flex h-10 items-center gap-1.5 rounded-md border border-gray-300 px-3 text-[13px] font-medium">{ic("plus")}Додати</button></div>''')

    copy = section("Авторське право / попередня публікація","Заповніть, лише якщо книга вже виходила раніше на іншій платформі — до приєднання до ULIT.", f'''
<div class="grid grid-cols-[120px_1fr] gap-3">{inp("Рік","2013")}{inp("Власник авторського права",ph="Наприклад: Валентина Островська",hl="red",err="Обов'язкове поле, якщо вказано рік")}</div>
<div class="mt-3">{inp("Номер свідоцтва про публікацію",ph="Наприклад: №113122609908")}</div>
<div class="my-4 h-px bg-gray-100"></div>
{inp("ISBN, вже присвоєний книзі раніше","978-5-4474-2357-5",helper="Лише якщо книга вже мала власний ISBN до ULIT — він стане ISBN цієї книги, реєстрація в Книжковій палаті через ULIT більше не знадобиться. Зберігається разом з усією формою.")}
<label class="mt-3 flex items-start gap-2.5 text-[14px]"><span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-green-600 bg-green-600 text-white">{ic("check","!w-3 !h-3")}</span>Підтверджую, що цей ISBN дійсно раніше офіційно присвоєно саме цій книзі, і я несу відповідальність за коректність цих даних.</label>''', hl="red", badge="1 помилка", sid="blk-copyright")

    banner = PUBLISHED_BANNER

    main = f'''{stepper}
<main class="flex-1 px-8 pb-28 pt-6">
  <div class="wf-only mb-4 flex items-center gap-2 text-[12px]"><span class="wf-note">WF · панель збереження:</span>
    <a href="?state=dirty" class="rounded border px-2 py-0.5">є незбережені зміни</a>
    <a href="?state=saved" class="rounded border px-2 py-0.5">збережено</a></div>
  {banner}
  <h1 class="mt-6 flex items-center gap-2 text-[20px] font-bold">{ic("circle-check","text-green-600 !w-5 !h-5")}Вихідні дані</h1>
  <div id="blk-main" {hl_attr("amber","card","border border-gray-200")[:-1]} relative mt-4 scroll-mt-20 rounded-xl p-6">
    <div class="absolute -top-3 right-5 bg-white px-1">{card_badge("amber","Змінено · 2 поля")}</div>
    <div class="grid grid-cols-2 gap-8">{left}{right}</div>
  </div>
  <div class="mt-5 space-y-5">{authors}{team}{copy}</div>
</main>'''

    bar = f'''<style>html{{scroll-behavior:smooth}}</style>
<div class="sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 px-8 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur">
  <div class="flex items-center gap-4">
    <a href="dashboard.html" class="inline-flex items-center gap-1.5 text-[14px] text-gray-600">{ic("arrow-left")}До дашборду книги</a>
    <div class="ml-auto flex items-center gap-3">
      <span data-state="dirty" data-default="dirty" class="inline-flex items-center gap-2 text-[13px] text-amber-700"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Є незбережені зміни у 2 блоках<span class="text-gray-300">·</span><a href="#blk-copyright" class="inline-flex items-center gap-1 font-medium text-red-600 underline decoration-red-300 underline-offset-2"><span class="h-2 w-2 rounded-full bg-red-500"></span>1 помилка</a></span>
      <a data-state="dirty" data-default="dirty" href="#blk-main" class="inline-flex h-7 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-[12px] font-medium text-amber-800 hover:bg-amber-100">{ic("arrow-up","!w-3.5 !h-3.5")}Перейти до першого</a>
      <span data-state="saved" data-default="dirty" class="inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700">{ic("check")}Збережено ✓ · 12:41</span>
      <button data-state="dirty" data-default="dirty" class="inline-flex h-10 items-center gap-1.5 rounded-md bg-green-600 px-5 text-[14px] font-medium text-white shadow-sm">{ic("save")}Зберегти зміни<span class="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white" title="1 помилка — виправте перед збереженням">{ic("circle-alert","!w-3 !h-3")}1</span></button>
      <button data-state="saved" data-default="dirty" disabled class="inline-flex h-10 items-center gap-1.5 rounded-md bg-gray-100 px-5 text-[14px] font-medium text-gray-400">{ic("save")}Зберегти зміни</button>
    </div>
  </div></div>
{HL_SCRIPT}'''
    return page("ULIT — Вихідні дані (WF)", "output", main, bar)

# ---------------------------------------------------------------- SHARED (05–07)
def tip(text):
    """Скорочена умова в один рядок + ⓘ з повним текстом у title (tooltip)."""
    return f'<span class="cursor-help text-gray-400" title="{text}">{ic("info","!w-3.5 !h-3.5")}</span>'

def save_bar(left_extra="", dirty_html="", saved_html="", dirty_btns="", saved_btns="", st_dirty="dirty", st_saved="saved", default="dirty"):
    """Sticky нижня панель як у 03: «← До дашборду книги» · стан · кнопки."""
    return f'''<style>html{{scroll-behavior:smooth}}</style>
<div class="sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 px-8 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur">
  <div class="flex items-center gap-4">
    <a href="dashboard.html" class="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] text-gray-600">{ic("arrow-left")}До дашборду книги</a>{left_extra}
    <div class="ml-auto flex items-center gap-3 whitespace-nowrap">
      <span data-state="{st_dirty}" data-default="{default}" class="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-amber-700">{dirty_html}</span>
      <span data-state="{st_saved}" data-default="{default}" class="inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700">{saved_html}</span>
      <span data-state="{st_dirty}" data-default="{default}" class="contents">{dirty_btns}</span>
      <span data-state="{st_saved}" data-default="{default}" class="contents">{saved_btns}</span>
    </div>
  </div></div>
{HL_SCRIPT}'''

def wf_switch(label, states):
    links = "".join(f'<a href="?state={k}" class="rounded border px-2 py-0.5">{v}</a>' for k, v in states)
    return f'<div class="wf-only mb-4 flex items-center gap-2 text-[12px]"><span class="wf-note">WF · {label}:</span>{links}</div>'

def h1(title):
    return f'<h1 class="flex items-center gap-2 text-[20px] font-bold">{ic("circle-check","text-green-600 !w-5 !h-5")}{title}</h1>'

def dirty(on, off=""):
    """Показати `on` у стані dirty, `off` — у saved."""
    a = f'<span data-state="dirty" data-default="dirty">{on}</span>'
    return a + (f'<span data-state="saved" data-default="dirty">{off}</span>' if off else "")

FORMAT = "Стандартний 130×200 мм"
CHK_ON  = f'<span class="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-green-600 bg-green-600 text-white">{ic("check","!w-3 !h-3")}</span>'
CHK_OFF = '<span class="block h-4 w-4 shrink-0 rounded border border-gray-400 bg-white"></span>'
CHK_DIS = '<span class="block h-4 w-4 shrink-0 rounded border border-gray-200 bg-gray-100"></span>'

def store(name, icon, dis=False):
    return f'<span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-[13px] font-semibold {"text-gray-400" if dis else ""}">{ic(icon,"!w-3.5 !h-3.5 " + ("text-gray-300" if dis else "text-gray-500"))}{name}</span>'

def money_in(val, hl=None, dis=False):
    box = hl_attr(hl, "box", "border-gray-200")
    if dis:
        return '<span class="text-gray-300">—</span>'
    return f'<div {box[:-1]} flex h-9 w-28 items-center justify-between rounded-md border bg-white px-3 text-[14px] font-medium">{val}<span class="text-[12px] font-normal text-gray-400">грн</span></div>'

TH = '''<thead><tr class="bg-gray-50 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-500">
<th class="w-10 py-2.5 pl-4"></th><th class="w-[190px] py-2.5">Магазин</th><th class="w-[150px] py-2.5">Ваш гонорар</th><th class="w-[170px] whitespace-nowrap py-2.5">Ціна для читача</th><th class="py-2.5 pr-4">Умови</th></tr></thead>'''

def row(chk, st, money, price, cond, dis=False, extra_cls=""):
    return f'''<tr class="border-t border-gray-100 align-middle {"bg-gray-50/60" if dis else ""} {extra_cls}"><td class="py-3 pl-4">{chk}</td><td class="py-3">{st}</td><td class="py-3">{money}</td>
<td class="py-3 text-[14px] {"text-gray-400" if dis else ""}">{price}</td><td class="py-3 pr-4 text-[13px] {"text-gray-400" if dis else "text-gray-600"}">{cond}</td></tr>'''

# ---------------------------------------------------------------- 05 PRICE
def price():
    ebook = section("Продаж електронної книги", "Ціна для читача рахується з вашого гонорару автоматично.", f'''
<div class="overflow-hidden rounded-lg border border-gray-200"><table class="w-full">{TH}<tbody>
{row(CHK_ON, store("ULIT","book-open"), money_in("100"), "<b>142.86 грн</b>", f'<span class="inline-flex items-center gap-1">70% після ПДВ · комісія 30% {tip("Роялті складає 70% від ціни після відрахування ПДВ. Ціна для покупця (комісія 30%): 142.86 грн — саме ця ціна й буде збережена. На інших каналах кінцева ціна відрізняється через їхню власну комісію.")}</span>')}
{row(CHK_OFF, store("Draft2Digital","globe"), money_in("100"), "166.67 грн", f'<span class="inline-flex items-center gap-1">40+ ритейлерів {tip("40+ ритейлерів: Barnes & Noble, Kobo, Apple Books та інші.")}</span>')}
{row(CHK_DIS, store("Amazon KDP","shopping-cart", dis=True), money_in("", dis=True), "—", f'<span class="inline-flex items-center gap-1.5 font-medium text-gray-600">{ic("ban","!w-3.5 !h-3.5 text-gray-400")}Недоступно для цієї мови — Kindle приймає лише друковані</span>', dis=True)}
{row(CHK_OFF, store("Google Play Books","play"), '<span class="text-[13px] text-gray-400">не задається</span>', "—", f'<span class="inline-flex items-center gap-1">Ціну встановлює магазин {tip("Роялті не регулюється автором. Відрахування залежать від прочитань книги у Google Play Books.")}</span>')}
{row(CHK_DIS, store("Amazon KDP Select","lock", dis=True), money_in("", dis=True), "—", f'<span class="inline-flex items-center gap-1.5 font-medium text-gray-600">{ic("ban","!w-3.5 !h-3.5 text-gray-400")}Недоступно: ексклюзивність 90 днів конфліктує з Draft2Digital і Google Play {tip("Ексклюзивність 90 днів: Draft2Digital і Google Play Books будуть заблоковані, скасувати не можна до кінця терміну.")}</span>', dis=True)}
</tbody></table></div>''', sid="blk-ebook")

    def cell(color, cover, price_saved, cur=False, changed=False):
        sel_cls = "border-2 border-green-600 bg-green-50/40" if cur else "border border-gray-200 bg-white hover:border-gray-400"
        p = (dirty(f'<span class="text-[12px] text-gray-400 line-through">374.29</span> <b class="text-amber-700">388.57 грн</b>', f'<b>{price_saved} грн</b>') if changed else f'<b>{price_saved} грн</b>')
        return f'''<a class="block rounded-lg {sel_cls} px-3 py-2"><div class="flex items-center justify-between text-[12px] text-gray-500"><span>{cover}</span>{ic("circle-check","!w-3.5 !h-3.5 text-green-600") if cur else ""}</div><div class="mt-0.5 text-[14px]">{p}</div></a>'''
    matrix = f'''<div class="grid grid-cols-[110px_1fr_1fr] items-center gap-2 text-[13px]">
  <div></div><div class="text-[12px] font-semibold uppercase tracking-wide text-gray-500">М'яка обкладинка</div><div class="text-[12px] font-semibold uppercase tracking-wide text-gray-500">Тверда обкладинка</div>
  <div class="font-medium">Кольоровий блок</div>{cell("c","Кольоровий · м'яка","388.57",cur=True,changed=True)}{cell("c","Кольоровий · тверда","517.14")}
  <div class="font-medium">Ч/Б блок</div>{cell("bw","Ч/Б · м'яка","150.00")}{cell("bw","Ч/Б · тверда","292.86")}
</div>'''

    royalty_changed = f'''<div>{money_in(dirty("160","160"), hl="amber")}<div data-state="dirty" data-default="dirty" class="mt-1 text-[11px] text-amber-700">було <span class="line-through">150</span> → 160 грн</div></div>'''
    print_tbl = f'''<div class="overflow-hidden rounded-lg border border-gray-200"><table class="w-full">{TH}<tbody>
{row(CHK_ON, store("ULIT","book-open"), royalty_changed, dirty('<span class="text-[13px] text-gray-400 line-through">374.29</span> <b class="text-amber-700">388.57 грн</b>','<b>388.57 грн</b>'), f'<span class="inline-flex items-center gap-1">Собівартість 112.00 + гонорар + комісія 30% {tip("Собівартість (м’яка): 112.00 грн + Ваш гонорар + комісія платформи = ціна для покупця.")}</span>')}
{row(CHK_OFF, store("Amazon KDP","shopping-cart"), money_in("200"), "від 445.71 грн", f'<span class="inline-flex items-center gap-1">Друк на вимогу · ціна до знижок {tip("Книга буде продаватися за технологією «Друк на вимогу». Ціна до знижок у магазині.")}</span>')}
</tbody></table></div>'''
    printed = section("Друкована книга", "Безкоштовно для автора. Друк оплачує читач, купуючи книгу в магазині.", f'''
<div class="flex flex-wrap items-center gap-2 text-[13px]"><span class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1">{ic("ruler","!w-3.5 !h-3.5 text-gray-500")}Формат: <b class="font-medium">{FORMAT}</b></span><span class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1">{ic("file-text","!w-3.5 !h-3.5 text-gray-500")}12 сторінок</span><span class="text-gray-400">· змінюються у «Вихідних даних» / «Рукописі»</span></div>
<div class="mt-4 text-[13px] font-semibold">Варіанти друку — ціна для читача в ULIT</div>
<p class="mb-2 text-[12px] text-gray-500">Оберіть варіант, щоб налаштувати гонорар. Позначено поточний.</p>
{matrix}
<div class="mt-5 mb-2 text-[13px] font-semibold">Кольоровий блок · м'яка обкладинка</div>
{print_tbl}''', hl="amber", badge="Змінено · 1 поле", sid="blk-print")

    main = f'''{stepper_bar(3)}
<main class="flex-1 px-8 pb-28 pt-6">
  {wf_switch("панель збереження", [("dirty","є незбережені зміни (гонорар 150→160)"),("saved","збережено")])}
  {h1("Ціна та розповсюдження")}
  <p class="mt-1 text-[13px] text-gray-500">Вкажіть гонорар — ціну для читача буде пораховано автоматично. <span class="wf-note">WF: чи потрібна повторна модерація при зміні ціни опублікованої книги — відкрите питання</span></p>
  <div class="mt-5 space-y-5">{ebook}{printed}</div>
</main>'''
    bar = save_bar(
        dirty_html=f'<span class="h-2 w-2 rounded-full bg-amber-500"></span><a href="#blk-print" class="underline decoration-amber-300 underline-offset-2">Є незбережені зміни у 1 блоці</a><span class="text-gray-300">·</span><span class="text-gray-600" title="ULIT: нова ціна з’явиться одразу після збереження">ULIT: нова ціна — одразу після збереження</span>',
        saved_html=f'{ic("check")}Збережено ✓ · 12:41',
        dirty_btns=f'<button class="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-3 text-[14px] font-medium">Скасувати</button><button class="inline-flex h-10 items-center gap-1.5 rounded-md bg-green-600 px-5 text-[14px] font-medium text-white shadow-sm">{ic("save")}Зберегти зміни</button>',
        saved_btns=f'<button disabled class="inline-flex h-10 items-center gap-1.5 rounded-md bg-gray-100 px-5 text-[14px] font-medium text-gray-400">{ic("save")}Зберегти зміни</button>')
    return page("ULIT — Ціна та розповсюдження (WF)", "output", main, bar)

# ---------------------------------------------------------------- 06 COVER
def cover():
    status = f'''<div class="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50/60 p-5">
  <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">{ic("check","!w-5 !h-5")}</div>
  <div class="min-w-0 flex-1"><div class="text-[16px] font-bold">Обкладинку завантажено</div>
    <p class="text-[13px] text-gray-600">Використовується для електронної та друкованої версій · формат {FORMAT}, 12 сторінок</p></div>
  <a class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 text-[14px] font-medium">{ic("upload")}Замінити файлом</a>
  <a class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-green-600 px-4 text-[14px] font-medium text-white shadow-sm">{ic("pencil")}Редагувати обкладинку</a>
</div>'''
    front = f'''<div class="flex h-full flex-col items-center justify-between bg-slate-50 p-3"><div class="pt-1 text-[15px] font-bold">Назва книги</div>
<div class="flex h-24 w-full items-center justify-center rounded bg-slate-400/50 text-slate-600">{ic("image","!w-6 !h-6")}</div><div class="text-[10px] text-gray-600">e2e</div></div>'''
    ebook = f'''<div class="rounded-xl border border-gray-200 p-5">
  <h2 class="text-[16px] font-bold">Електронна обкладинка</h2><p class="mt-0.5 text-[13px] text-gray-500">Так її бачать у магазинах.</p>
  <div class="mt-4 flex justify-center"><div class="w-[170px] rounded-[18px] border-2 border-gray-300 bg-white p-2 shadow-sm">
    <div class="mx-auto mb-1.5 h-1 w-1 rounded-full bg-gray-400"></div><div class="aspect-[2/3] overflow-hidden rounded">{front}</div>
    <div class="mx-auto mt-1.5 h-3 w-3 rounded-full border border-gray-300"></div></div></div>
</div>'''
    def spread(spine_w, hard=False):
        back = '''<div class="flex h-full flex-col bg-white"><div class="p-2.5 text-[7px] leading-tight text-gray-500">Анотація до книги має бути такої довжини, щоб читач зрозумів, про що книга, і захотів її відкрити. Розкажіть про головного героя, конфлікт і атмосферу…</div><div class="flex-1 bg-gray-200"></div><div class="h-7"></div></div>'''
        pad = "p-2 bg-slate-200" if hard else ""
        return f'''<div class="relative {pad} rounded">
<div class="relative grid h-[230px] border border-gray-300 bg-white" style="grid-template-columns:1fr {spine_w}px 1fr">
  {back}
  <div class="relative bg-white"><span class="absolute inset-y-0 left-0 border-l-2 border-dashed border-gray-500"></span><span class="absolute inset-y-0 right-0 border-l-2 border-dashed border-gray-500"></span></div>
  {front}
  <span class="pointer-events-none absolute inset-1.5 border border-dotted border-rose-400"></span>
</div></div>'''
    labels = lambda sw: f'''<div class="mb-1 grid text-center text-[11px] font-medium text-gray-500" style="grid-template-columns:1fr {sw+40}px 1fr"><span>Задня сторона</span><span>Корінець</span><span>Лицева</span></div>'''
    printc = f'''<div class="rounded-xl border border-gray-200 p-5">
  <div class="flex items-start justify-between gap-3"><div><h2 class="text-[16px] font-bold">Обкладинка для друку</h2><p class="mt-0.5 text-[13px] text-gray-500">Розворот: задня сторона · корінець · лицева.</p></div>
    <div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-[13px]"><span class="rounded bg-white px-3 py-1 font-medium shadow-sm">М'яка</span><span class="px-3 py-1 text-gray-500">Тверда</span></div></div>
  <div class="mt-4">{labels(10)}{spread(10)}</div>
  <div class="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-gray-600">
    <span class="inline-flex items-center gap-1.5"><span class="w-6 border-t-2 border-dashed border-gray-500"></span>згин (корінець)</span>
    <span class="inline-flex items-center gap-1.5"><span class="w-6 border-t border-dotted border-rose-400"></span>обріз — фон заводьте за лінію</span>
    <span class="ml-auto text-gray-400">{FORMAT} · 12 с.</span></div>
</div>'''
    ok = lambda t: f'<li class="flex items-start gap-2">{ic("circle-check","mt-0.5 !w-4 !h-4 shrink-0 text-green-600")}<span>{t}</span></li>'
    checklist = f'''<div class="rounded-xl border border-gray-200 p-5">
  <div class="flex items-center justify-between"><h2 class="text-[16px] font-bold">Вимоги до обкладинки</h2><span class="text-[13px] font-medium text-green-700">3 з 4 ✓</span></div>
  <p class="mt-1"><span class="wf-note">WF-приклад: перелік правил і числа — заглушки, підтвердити з друкарнею/магазинами</span></p>
  <ul class="mt-3 space-y-2 text-[14px]">
    {ok("Електронна обкладинка завантажена")}
    {ok(f"Розворот для друку сформовано під формат {FORMAT}")}
    {ok("Назва книги та автор є на лицевій стороні")}
    <li class="flex items-start gap-2 rounded-md bg-amber-50 px-2 py-1.5 ring-1 ring-amber-200">{ic("triangle-alert","mt-0.5 !w-4 !h-4 shrink-0 text-amber-600")}<span><b class="font-medium">Текст на корінці: немає</b> — для 12 сторінок корінець завузький для тексту. <span class="text-amber-800/80">Нічого робити не потрібно.</span></span></li>
  </ul>
</div>'''
    main = f'''{stepper_bar(2)}
<main class="flex-1 px-8 pb-10 pt-6">
  {PUBLISHED_BANNER}
  <div class="mt-6">{h1("Обкладинка")}</div>
  <div class="mt-4">{status}</div>
  <div class="mt-5 grid grid-cols-[300px_minmax(0,1fr)] gap-5">{ebook}{printc}</div>
  <div class="mt-5">{checklist}</div>
  <a href="dashboard.html" class="mt-6 inline-flex items-center gap-1.5 text-[14px] text-gray-600">{ic("arrow-left")}До дашборду книги</a>
</main>'''
    return page("ULIT — Обкладинка (WF)", "cover", main)

# ---------------------------------------------------------------- 07 REVIEW
def review():
    def card(title, href, body, changed=False, sid="", cls=""):
        attrs = (f'data-hl="changes" data-default="published" data-hl-on="border-2 border-amber-400" data-hl-off="border border-gray-200" class="border border-gray-200' if changed else 'class="border border-gray-200')
        badge = (f'<span data-state="changes" data-default="published" class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-800 ring-1 ring-amber-300">{ic("pencil","!w-3 !h-3")}Змінено</span>' if changed else "")
        return f'''<section{f' id="{sid}"' if sid else ""} {attrs} scroll-mt-20 rounded-xl p-5 {cls}">
<div class="flex items-center justify-between gap-3"><div class="flex items-center gap-2"><h2 class="text-[16px] font-bold">{title}</h2>{badge}</div>
<a href="{href}" class="inline-flex items-center gap-1 text-[13px] font-medium underline">{ic("pencil","!w-3.5 !h-3.5")}Змінити</a></div>
<div class="mt-3">{body}</div></section>'''
    def dl(rows):
        return '<dl class="divide-y divide-gray-100 text-[14px]">' + "".join(
            f'<div class="flex justify-between gap-4 py-1.5"><dt class="text-gray-500">{k}</dt><dd class="text-right font-medium">{v}</dd></div>' for k, v in rows) + "</dl>"
    chg_dot = '<span data-state="changes" data-default="published" class="ml-1.5 rounded bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">змінено</span>'
    out = card("Вихідні дані", "output-data.html", dl([("Назва","Назва книги"),("Підзаголовок"+chg_dot,"Роман у віршах"),("Анотація"+chg_dot,"257 / 500 символів"),("Жанр","Поезія"),("Розмір книги",FORMAT),("Мова","Українська"),("Вікові обмеження","18+")]), changed=True, sid="blk-out")
    ms = card("Рукопис", "#", dl([("Рукопис",f'<span class="inline-flex items-center gap-1 text-green-700">{ic("check","!w-3.5 !h-3.5")}Завантажено</span>'),("Кількість сторінок","12 ст.")]))
    cv = card("Обкладинка", "cover.html", f'''<div class="flex items-center gap-3"><div class="flex h-20 w-14 shrink-0 flex-col items-center justify-between rounded border border-gray-200 bg-slate-100 p-1"><span class="text-[6px] font-bold">Назва книги</span><span class="h-8 w-full rounded-sm bg-slate-400/50"></span><span class="text-[5px]">e2e</span></div>
{dl([("Обкладинка",f'<span class="inline-flex items-center gap-1 text-green-700">{ic("check","!w-3.5 !h-3.5")}Завантажено</span>'),("Друк",FORMAT)])}</div>''')
    def pr(variant, price, profit, changed=False):
        if changed:
            price = f'<span data-state="changes" data-default="published"><span class="text-[12px] text-gray-400 line-through">374.29</span> <b class="text-amber-700">388.57 грн</b></span><span data-state="published" data-default="published">374.29 грн</span>'
            profit = f'<span data-state="changes" data-default="published"><span class="text-[12px] text-gray-400 line-through">262.00</span> <b class="text-amber-700">272.00 грн</b></span><span data-state="published" data-default="published">262.00 грн</span>'
        else:
            price, profit = f"{price} грн", f"{profit} грн"
        return f'<tr class="border-t border-gray-100"><td class="py-2 pl-4">{variant}{chg_dot if changed else ""}</td><td class="py-2">{price}</td><td class="py-2 font-medium">{profit}</td><td class="py-2 pr-4">{store("ULIT","book-open")}</td></tr>'
    prices = card("Ціна та розповсюдження", "price.html", f'''
<div class="overflow-hidden rounded-lg border border-gray-200"><table class="w-full text-[14px]">
<thead><tr class="bg-gray-50 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-500"><th class="py-2.5 pl-4">Варіант</th><th class="py-2.5">Ціна для читача</th><th class="py-2.5">Ваш прибуток</th><th class="py-2.5 pr-4">Магазин</th></tr></thead><tbody>
{pr("Е-книга","142.86","100.00")}{pr("Друк, м'яка (кольор.)","","",changed=True)}{pr("Друк, тверда (кольор.)","517.14","362.00")}{pr("Друк, м'яка (ч/б)","150.00","105.00")}{pr("Друк, тверда (ч/б)","292.86","205.00")}
</tbody></table></div>
<p class="mt-1.5 text-[12px] text-gray-500">Прибуток — за один проданий примірник, після комісії платформи.</p>
<div class="mt-4 flex items-center gap-2 text-[14px]"><span class="text-gray-500">Магазини:</span>{store("ULIT","book-open")}<a href="price.html" class="ml-1 inline-flex items-center gap-1 text-[13px] font-medium text-green-700 underline">{ic("plus","!w-3.5 !h-3.5")}Додати магазини</a></div>''', changed=True, sid="blk-price", cls="col-span-2")
    udk_items = ["Анотація (файл 1 для заявки на УДК) — 120–500 символів","Повне ПІБ автора (файл 1 для заявки на УДК)","Обкладинка завантажена","PDF для друку рукопису (файл 2 для заявки на УДК)"]
    udk = f'''<details class="col-span-2 rounded-xl border border-gray-200">
<summary class="flex cursor-pointer items-center gap-3 p-5"><h2 class="text-[16px] font-bold">Готовність до реєстрації УДК</h2>
<span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[12px] font-medium text-green-700 ring-1 ring-green-200">{ic("check","!w-3 !h-3")}4 з 4 вимог виконано</span>
<span class="ml-auto inline-flex items-center gap-1 text-[13px] text-gray-500">Показати{ic("chevron-down","chev transition")}</span></summary>
<div class="border-t border-gray-100 px-5 pb-4 pt-3 text-[14px]"><p class="text-[13px] text-gray-500">Дані для заявки на УДК і авторський знак у Книжковій палаті. ISBN сюди не входить — видавець призначає його сам.</p>
<ul class="mt-2 space-y-1">{"".join(f'<li class="flex items-center gap-2">{ic("check","!w-4 !h-4 text-green-600")}{t}</li>' for t in udk_items)}</ul></div></details>'''
    main = f'''{stepper_bar(4)}
<main class="flex-1 px-8 pb-28 pt-6">
  {wf_switch("стан", [("published","опубліковано, змін немає"),("changes","є зміни з останньої публікації")])}
  {h1("Огляд перед публікацією")}
  <p class="mt-1 text-[13px] text-gray-500">Так дані книги підуть у магазини. Щоб виправити — «Змінити» у потрібному блоці.</p>
  <div class="mt-5 grid grid-cols-2 gap-5">{out}<div class="space-y-5">{ms}{cv}</div>{prices}{udk}</div>
</main>'''
    bar = save_bar(
        dirty_html=f'<span class="h-2 w-2 rounded-full bg-amber-500"></span><a href="#blk-out" class="underline decoration-amber-300 underline-offset-2">Змінено 2 блоки з останньої публікації</a><span class="text-gray-300">·</span><span class="text-gray-600">зміни підуть на повторну модерацію</span>',
        saved_html=f'{ic("circle-check")}Усі зміни опубліковано',
        dirty_btns=f'<button class="inline-flex h-10 items-center gap-1.5 rounded-md bg-green-600 px-5 text-[14px] font-medium text-white shadow-sm">{ic("upload-cloud")}Опублікувати зміни<span class="ml-0.5 rounded-full bg-white/25 px-1.5 text-[11px]">2</span></button>',
        saved_btns="", st_dirty="changes", st_saved="published", default="published")
    return page("ULIT — Огляд перед публікацією (WF)", "output", main, bar)


INDEX = HEAD.format(title="ULIT — вайрфрейми") + f'''
<main class="mx-auto max-w-2xl px-6 py-12">
  <h1 class="text-[24px] font-bold">ULIT — редизайн дашборду книги · WF v1</h1>
  <p class="mt-2 text-[14px] text-gray-600">HTML — референс; будувати на наявних компонентах/токенах apps/web (shadcn Button, Badge, Card; lucide-іконки).</p>
  <ul class="mt-6 space-y-2 text-[15px]">
    <li><a class="text-green-700 underline" href="dashboard.html?state=published">01 Дашборд — опубліковано</a></li>
    <li><a class="text-green-700 underline" href="dashboard.html?state=changes">02 Дашборд — є неопубліковані зміни (кроки розгорнуто)</a></li>
    <li><a class="text-green-700 underline" href="dashboard.html?state=menu">04 Дашборд — відкрите меню «⋯»</a></li>
    <li><a class="text-green-700 underline" href="output-data.html?state=dirty">03 Вихідні дані — є незбережені зміни</a></li>
    <li><a class="text-green-700 underline" href="output-data.html?state=saved">03b Вихідні дані — збережено ✓</a></li>
    <li><a class="text-green-700 underline" href="price.html?state=dirty">05 Ціна та розповсюдження — є незбережені зміни (гонорар 150→160)</a></li>
    <li><a class="text-green-700 underline" href="price.html?state=saved">05b Ціна та розповсюдження — збережено ✓</a></li>
    <li><a class="text-green-700 underline" href="cover.html">06 Обкладинка</a></li>
    <li><a class="text-green-700 underline" href="review.html?state=changes">07 Огляд перед публікацією — є зміни з останньої публікації</a></li>
    <li><a class="text-green-700 underline" href="review.html?state=published">07b Огляд перед публікацією — опубліковано</a></li>
    <li><a class="text-green-700 underline" href="WF-SPEC.md">WF-SPEC.md</a> · <a class="text-green-700 underline" href="shots/">shots/</a></li>
  </ul>
  <p class="mt-6 text-[13px] text-gray-500">Додайте <code>&clean=1</code>, щоб сховати службові WF-перемикачі.</p>
</main>''' + FOOT

(OUT/"dashboard.html").write_text(dashboard())
(OUT/"output-data.html").write_text(output_data())
(OUT/"price.html").write_text(price())
(OUT/"cover.html").write_text(cover())
(OUT/"review.html").write_text(review())
(OUT/"index.html").write_text(INDEX)
print("ok")
