#!/usr/bin/env python3
"""Только 911 — page generator (Python 3, no packages needed).

Run from the site folder (the one with index.html and cars.txt):

    python3 build.py                              # uses BASE_URL below
    python3 build.py https://only911.pages.dev/   # or give the address

What it does
  1. Sets the Open Graph / Twitter URLs in index.html to the base URL.
  2. Builds car/<folder>.html for every folder listed in cars.txt, from the
     card file assets/<folder>/<folder>-00-Card.txt. A car page is index.html
     plus that car's own title, description, URL and image.

Adding a car:    add its folder to cars.txt, put the card file in the folder, run this.
Deleting a car:  remove its line from cars.txt (and its asset folder), run this - its page is deleted.
Changing host:   change BASE_URL (or pass it on the command line), run this.
Changing the home page head or body: edit index.html, run this, and the car pages follow.
"""
import re
import sys
from pathlib import Path

BASE_URL = "https://only911.pages.dev/"

ROOT = Path(__file__).resolve().parent
SITE_NAME = "Только 911"
CAR_DESCRIPTION_TAIL = "Подбор и доставка классического Porsche 911 из Европы."
NBSP = "\u00a0"


# ---- the same display rules script.js uses (keep these in step with it) -------------------------
def ru_units(value):
    value = re.sub(r"(\d),(?=\d{3}\b)", "\\1" + NBSP, str(value))
    value = re.sub(r"\b(?:km|kms|kilometers|kilometres)\b", "км", value, flags=re.I)
    value = re.sub(r"\b(?:miles?|mi)\b", "миль", value, flags=re.I)
    value = re.sub(r"\bcc\b", "см³", value, flags=re.I)
    value = re.sub(r"\b(?:hp|bhp|ps)\b", "л.с.", value, flags=re.I)
    value = re.sub(r"\bkw\b", "кВт", value, flags=re.I)
    return value


def group_digits(value):
    value = re.sub(r"(\d),(?=\d{3}\b)", "\\1" + NBSP, str(value))
    return re.sub(r"\b\d{4,}\b", lambda m: re.sub(r"\B(?=(\d{3})+$)", NBSP, m.group(0)), value)


def esc(value):
    """Same escaping as escapeHTML() in script.js."""
    out = str(value)
    for ch, rep in (("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ('"', "&quot;"), ("'", "&#39;")):
        out = out.replace(ch, rep)
    return out


# ---- card files ---------------------------------------------------------------------------------
FIELDS = ["title", "series", "year", "mileage", "displacement", "power", "transmission", "price",
          "history", "description", "imageAlt", "prefix", "color", "stock_number"]
FIELD_LOOKUP = {name.lower(): name for name in FIELDS}


def parse_card(text):
    entry, key, buf = {}, None, []

    def flush():
        if key:
            entry[key] = " ".join(buf).strip() if key not in ("history", "description") else "\n".join(buf).strip()

    for line in text.lstrip("\ufeff").splitlines():
        m = re.match(r"^\s*([A-Za-z_]+)\s*:\s?(.*)$", line)
        if m and m.group(1).lower() in FIELD_LOOKUP:
            flush()
            key, buf = FIELD_LOOKUP[m.group(1).lower()], [m.group(2)]
        elif key:
            buf.append(line)
    flush()
    return entry


# ---- building -----------------------------------------------------------------------------------
def set_meta(html, attr, name, value):
    """Replace content="..." of the <meta> whose attr (property/name) equals name."""
    pattern = re.compile(r'(<meta\s+%s="%s"\s+content=")[^"]*(")' % (attr, re.escape(name)))
    new, n = pattern.subn(lambda m: m.group(1) + value + m.group(2), html, count=1)
    if n != 1:
        sys.exit("ERROR: index.html has no <meta %s=\"%s\"> tag." % (attr, name))
    return new


def build_home(index_html, base):
    html = set_meta(index_html, "property", "og:url", base)
    for attr, name in (("property", "og:image"), ("name", "twitter:image")):
        html = set_meta(html, attr, name, base + "assets/Home/opengraph.jpg")
    return html


def build_car(home_html, base, folder, index_in_list, card):
    title = card.get("title") or "Porsche 911 %d" % (index_in_list + 1)
    year = card.get("year") or (re.search(r"\b(?:19|20)\d{2}\b", title) or [""])[0]
    price = group_digits(card.get("price", "").strip() or "Цена по запросу")
    mileage = group_digits(ru_units(card.get("mileage", "").strip() or "Пробег не указан"))
    description = "%s · %s · %s. %s" % (year, mileage, price, CAR_DESCRIPTION_TAIL)
    page_title = "%s — %s" % (title, SITE_NAME)
    image = "%sassets/%s/%s-Main-1200.webp" % (base, folder, folder)

    html = home_html
    html = set_meta(html, "name", "description", esc(description))
    html = re.sub(r"<title>.*?</title>", lambda m: "<title>%s</title>" % esc(page_title), html, count=1, flags=re.S)
    html = set_meta(html, "property", "og:title", esc(page_title))
    html = set_meta(html, "property", "og:description", esc(description))
    html = set_meta(html, "property", "og:url", "%scar/%s.html" % (base, folder))
    html = set_meta(html, "property", "og:image", image)
    html = set_meta(html, "property", "og:image:type", "image/webp")
    html = set_meta(html, "property", "og:image:height", "800")
    html = set_meta(html, "name", "twitter:image", image)
    # <base> and CAR_ID go straight after <head>
    return html.replace("<head>\n", '<head>\n  <base href="../">\n  <script>window.CAR_ID="%s";</script>\n' % folder, 1)


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else BASE_URL).strip()
    if not re.match(r"^https?://", base):
        sys.exit("ERROR: the base URL must start with http:// or https://  (got: %s)" % base)
    if not base.endswith("/"):
        base += "/"

    index_path = ROOT / "index.html"
    home = build_home(index_path.read_text(encoding="utf-8"), base)
    changed = []
    if home != index_path.read_text(encoding="utf-8"):
        index_path.write_text(home, encoding="utf-8", newline="")
        changed.append("index.html")

    folders = [l.strip().strip("/") for l in (ROOT / "cars.txt").read_text(encoding="utf-8").splitlines()]
    folders = [f for f in folders if f and not f.startswith("#")]
    if not folders:
        sys.exit("ERROR: cars.txt lists no cars - stopping so no pages are removed by mistake.")
    (ROOT / "car").mkdir(exist_ok=True)
    built, skipped = 0, []
    for i, folder in enumerate(folders):
        card_path = ROOT / "assets" / folder / ("%s-00-Card.txt" % folder)
        if not card_path.is_file():
            skipped.append(folder)
            continue
        page = build_car(home, base, folder, i, parse_card(card_path.read_text(encoding="utf-8")))
        out = ROOT / "car" / ("%s.html" % folder)
        if not out.is_file() or out.read_text(encoding="utf-8") != page:
            out.write_text(page, encoding="utf-8", newline="")
            changed.append("car/%s.html" % folder)
        built += 1

    # Deleted cars: a generated page (it contains window.CAR_ID) whose folder is no longer in cars.txt is removed.
    removed = []
    for page in sorted((ROOT / "car").glob("*.html")):
        if page.stem in folders:
            continue
        if "window.CAR_ID" in page.read_text(encoding="utf-8"):
            page.unlink()
            removed.append("car/%s.html" % page.stem)
        else:
            print("NOTE: car/%s.html is not a generated page - left in place." % page.stem)

    print("Base URL: %s" % base)
    print("Cars built: %d of %d   Files written: %d   Removed: %d" % (built, len(folders), len(changed), len(removed)))
    for name in changed:
        print("  updated", name)
    for name in removed:
        print("  removed", name)
    for folder in skipped:
        print("WARNING: no card file for %s - its page was not touched." % folder)


if __name__ == "__main__":
    main()
