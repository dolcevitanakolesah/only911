#!/usr/bin/env python3
"""
Makes link previews (WhatsApp, Telegram, etc.) work for only911.

Run from the site's root folder, after adding or changing cars:

    python3 build_share.py                              (uses https://only911.pages.dev)
    python3 build_share.py https://USER.github.io/REPO  (for testing on GitHub Pages)

It creates:
  (home preview: put your own 1200x630 assets/Home/opengraph.jpg there; this script does not touch it)
  assets/<car>/<car>-og.jpg            1200x630 preview for each car
  share/<car>.html                     tiny page with that car's preview tags,
                                       which sends visitors to index.html?car=<car>

Share the links  https://only911.pages.dev/share/<car>.html  for cars.
Share pages of cars that are no longer in cars.txt are deleted.
Needs Pillow:  pip install pillow
"""
import html, os, re, sys
from PIL import Image

DEFAULT_SITE = "https://only911.pages.dev"
SITE = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SITE).rstrip("/")
W, H = 1200, 630


def make_og(src, dst):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    new_h = round(w * H / W)
    top = max(0, (h - new_h) // 2)
    im = im.crop((0, top, w, top + new_h)).resize((W, H), Image.LANCZOS)
    for q in (82, 74, 66, 58):          # WhatsApp ignores images over ~300 KB
        im.save(dst, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(dst) < 280_000:
            break


def read_card(path):
    fields, key = {}, None
    for line in open(path, encoding="utf-8-sig"):
        m = re.match(r"\s*([A-Za-z_]+)\s*:\s?(.*)$", line)
        if m and m.group(1).lower() in ("title", "year", "mileage", "price", "series"):
            key = m.group(1).lower(); fields[key] = m.group(2).strip()
        elif m:
            key = None
    return fields


def ru(value):
    value = re.sub(r"(\d),(?=\d{3}\b)", "\\1\u00a0", value)
    return re.sub(r"\bkms?\b", "км", value, flags=re.I)


os.makedirs("share", exist_ok=True)

# Point the home page's preview tags at the same address.
idx = open("index.html", encoding="utf-8").read()
for prop, value in (("og:url", SITE + "/"), ("og:image", SITE + "/assets/Home/opengraph.jpg"),
                    ("twitter:image", SITE + "/assets/Home/opengraph.jpg")):
    idx = re.sub(r'(<meta (?:property|name)="%s" content=")[^"]*(")' % re.escape(prop),
                 lambda m: m.group(1) + value + m.group(2), idx)
open("index.html", "w", encoding="utf-8").write(idx)

folders = [l.strip() for l in open("cars.txt", encoding="utf-8") if l.strip() and not l.startswith("#")]
done, skipped = 0, []
for car in folders:
    card = f"assets/{car}/{car}-00-Card.txt"
    cover = f"assets/{car}/{car}-Main-1200.webp"
    if not (os.path.exists(card) and os.path.exists(cover)):
        skipped.append(car)
        continue
    f = read_card(card)
    make_og(cover, f"assets/{car}/{car}-og.jpg")
    title = f.get("title", "Porsche 911")
    desc = " · ".join(x for x in (f.get("year"), ru(f.get("mileage", "")), ru(f.get("price", ""))) if x)
    desc += ". Подбор и доставка классического Porsche 911 из Европы."
    page = f"{SITE}/share/{car}.html"
    img = f"{SITE}/assets/{car}/{car}-og.jpg"
    target = f"../index.html?car={car}"
    t, d = html.escape(title + " — Только 911", True), html.escape(desc, True)
    open(f"share/{car}.html", "w", encoding="utf-8").write(f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>{t}</title>
<meta name="description" content="{d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Только 911">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{page}">
<meta property="og:image" content="{img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="{W}">
<meta property="og:image:height" content="{H}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{img}">
<meta http-equiv="refresh" content="0; url={target}">
<script>location.replace("{target}");</script>
</head><body><a href="{target}">{t}</a></body></html>
""")
    done += 1

for name in os.listdir("share"):
    if name.endswith(".html") and name[:-5] not in folders:
        os.remove(os.path.join("share", name))
print(f"{done} car share pages for {SITE}")
if skipped:
    print("skipped (no card file or no Main-1200.webp):", ", ".join(skipped))
