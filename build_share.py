#!/usr/bin/env python3
"""
Gives every car its own real page, with its own link-preview (Open Graph) tags.

    python3 build_share.py                              (uses https://only911.pages.dev)
    python3 build_share.py https://USER.github.io/REPO  (for testing on GitHub Pages)

For each car in cars.txt it creates:
  car/<car>.html                1:1 copy of index.html with that car's title, photo and
                                price in the preview tags. It opens the car directly.
Cars no longer in cars.txt lose their page. Put your own assets/Home/opengraph.jpg for the home page.
"""
import html, os, re, shutil, sys

SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://only911.pages.dev").rstrip("/")


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


def set_meta(doc, attr, name, value):
    pat = r'(<meta %s="%s" content=")[^"]*(")' % (attr, re.escape(name))
    return re.sub(pat, lambda m: m.group(1) + html.escape(value, True) + m.group(2), doc)


# Home page tags follow the site address.
home = open("index.html", encoding="utf-8").read()
home_img = SITE + "/assets/Home/opengraph.jpg"
home = set_meta(home, "property", "og:url", SITE + "/")
home = set_meta(home, "property", "og:image", home_img)
home = set_meta(home, "name", "twitter:image", home_img)
open("index.html", "w", encoding="utf-8").write(home)

shutil.rmtree("share", ignore_errors=True)       # old helper pages are not needed any more
os.makedirs("car", exist_ok=True)
folders = [l.strip() for l in open("cars.txt", encoding="utf-8") if l.strip() and not l.startswith("#")]
basic = []
for car in folders:
    card, cover = f"assets/{car}/{car}-00-Card.txt", f"assets/{car}/{car}-Main-1200.webp"
    if os.path.exists(card) and os.path.exists(cover):
        f = read_card(card)
        title = f.get("title", "Porsche 911")
        desc = " \u00b7 ".join(x for x in (f.get("year"), ru(f.get("mileage", "")), ru(f.get("price", ""))) if x)
        desc += ". Подбор и доставка классического Porsche 911 из Европы."
        img, itype, iw, ih = f"{SITE}/assets/{car}/{car}-Main-1200.webp", "image/webp", "1200", "800"
    else:
        basic.append(car)
        parts = car.split("-")
        title = "Porsche " + parts[0] + (" \u2014 " + parts[-1] if len(parts) > 1 else "")
        desc = "Подбор и доставка классического Porsche 911 из Европы."
        img, itype, iw, ih = home_img, "image/jpeg", "1200", "630"
    full_title = title + " \u2014 Только 911"
    page = home
    page = re.sub(r"<title>.*?</title>", lambda m: "<title>%s</title>" % html.escape(full_title), page, count=1)
    page = set_meta(page, "name", "description", desc)
    page = set_meta(page, "property", "og:title", full_title)
    page = set_meta(page, "property", "og:description", desc)
    page = set_meta(page, "property", "og:url", f"{SITE}/car/{car}.html")
    page = set_meta(page, "property", "og:image", img)
    page = set_meta(page, "name", "twitter:image", img)
    page = set_meta(page, "property", "og:image:type", itype)
    page = set_meta(page, "property", "og:image:width", iw)
    page = set_meta(page, "property", "og:image:height", ih)
    page = page.replace("<head>", '<head>\n  <base href="../">\n  <script>window.CAR_ID=%s;</script>' % html.escape(repr(car).replace("'", '"'), False), 1)
    open(f"car/{car}.html", "w", encoding="utf-8").write(page)

print(f"{len(folders)} car pages for {SITE}")
if basic:
    print("basic preview only (no card file or no Main-1200.webp):", ", ".join(basic))
