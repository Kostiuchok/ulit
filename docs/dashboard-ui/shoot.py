import asyncio, sys
from playwright.async_api import async_playwright
SHOTS=[("01-dashboard-published","dashboard.html?state=published&clean=1",True),
       ("02-dashboard-changes","dashboard.html?state=changes&clean=1",True),
       ("04-dashboard-menu","dashboard.html?state=menu&clean=1",False),
       ("03-output-data-dirty","output-data.html?state=dirty&clean=1&static=1",True),
       ("03b-output-data-saved","output-data.html?state=saved&clean=1",False),
       ("03c-output-data-fold","output-data.html?state=dirty&clean=1",False),
       ("05-price-dirty","price.html?state=dirty&clean=1&static=1",True),
       ("05b-price-saved","price.html?state=saved&clean=1",False),
       ("06-cover","cover.html?clean=1&static=1",True),
       ("07-review-changes","review.html?state=changes&clean=1&static=1",True),
       ("07b-review-published","review.html?state=published&clean=1",False)]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg=await b.new_page(viewport={"width":1280,"height":800})
        only=sys.argv[1:]  # напр.: python3 shoot.py 03 — лише скріни з таким префіксом
        for name,url,full in SHOTS:
            if only and not any(name.startswith(o) for o in only): continue
            await pg.goto("file:///workspace/ulit-dashboard-ui/"+url); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f"shots/{name}.png",full_page=full)
            print(name, await pg.evaluate("document.documentElement.scrollHeight"))
        await b.close()
asyncio.run(main())
