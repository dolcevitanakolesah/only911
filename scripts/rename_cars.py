#!/usr/bin/env python3
"""
Rename every car from  <series>-<word>  to  <series>-<colour>-<place>.

What it does
  1. Renames the folder  assets/<old>/  ->  assets/<new>/
  2. Renames the files inside it that start with the old name
       (<old>-00-Card.txt, <old>-01-0300.webp, <old>-Main-0600.webp, <old>-video-01.mp4 ...)
  3. Replaces the old name with the new one inside text files
       (cars.txt, the card .txt files, html, js, json, css, md ...)

It is safe to run more than once: cars that were already renamed are left alone.

Usage:
    python scripts/rename_cars.py --dry-run     # only show what would change
    python scripts/rename_cars.py               # do it
"""
import argparse
import os
import re
import sys

# ----------------------------------------------------------------------------
# OLD NAME -> NEW NAME   (edit here if anything needs to change)
# ----------------------------------------------------------------------------
RENAMES = {
    "911F-Bologna":  "911F-Red-Bologna",     # the list you sent says "991F" - see note in README
    "911F-Green":    "911F-Green-Reggio",
    "911G-Black":    "911G-Black-Bologna",
    "911G-Red":      "911G-Red-Bologna",
    "911G-White":    "911G-White-Bologna",
    "964-Creances":  "964-Red-Creances",
    "964-Emilia":    "964-Pink-Emilia",
    "964-Rochelle":  "964-White-Rochelle",
    "993-Dueville":  "993-Silver-Dueville",
    "993-Forli":     "993-Black-Forli",
    "993-Paris":     "993-Blue-Paris",
    "993-Ravenna":   "993-Blue-Ravenna",
}
# Extra spellings that should be treated as an old name (typo in the original list)
ALIASES = {
    "991F-Bologna": "911F-Red-Bologna",
}

ASSETS_DIR = "assets"
TEXT_EXTENSIONS = {".txt", ".html", ".htm", ".js", ".json", ".css", ".md", ".xml", ".yml", ".yaml", ".svg"}
SKIP_DIRS = {".git", ".github", "node_modules", "scripts"}

ALL_OLD = {**RENAMES, **ALIASES}

# A file name belongs to a car if it starts with the old name followed by
# -NN (photo or card), -Main or -video. This is what makes re-runs safe:
# "911G-Red-Bologna-00-Card.txt" does NOT match "911G-Red".
FILE_RE = {
    old: re.compile(r"^" + re.escape(old) + r"(?=-(?:\d{2}|Main|video)\b)")
    for old in ALL_OLD
}
# In text: the old name, not glued to other word characters or a further "-Word".
# Allowed to be followed by -NN / -Main / -video (a file name) or by anything that
# is not a letter, digit, underscore or hyphen.
TEXT_RE = {
    old: re.compile(r"(?<![\w-])" + re.escape(old) + r"(?=$|[^\w-]|-(?:\d{2}|Main|video)\b)")
    for old in ALL_OLD
}

log = []

def say(msg):
    print(msg)

def rename_assets(dry):
    base = ASSETS_DIR
    if not os.path.isdir(base):
        say(f"! No '{ASSETS_DIR}/' folder found - nothing to rename on disk.")
        return
    for old, new in ALL_OLD.items():
        old_dir = os.path.join(base, old)
        new_dir = os.path.join(base, new)
        if not os.path.isdir(old_dir):
            if os.path.isdir(new_dir):
                say(f"= {old}: already renamed, skipping")
            else:
                say(f"! {old}: folder not found in {ASSETS_DIR}/")
            continue
        if os.path.exists(new_dir):
            say(f"! {old}: target {new_dir} already exists - skipped, check by hand")
            continue
        # files first, then the folder
        for name in sorted(os.listdir(old_dir)):
            m = FILE_RE[old].match(name)
            if m:
                new_name = new + name[m.end():]
                say(f"  file  {old}/{name}  ->  {new_name}")
                if not dry:
                    os.rename(os.path.join(old_dir, name), os.path.join(old_dir, new_name))
            else:
                say(f"  (left alone) {old}/{name}")
        say(f"  folder  {old_dir}  ->  {new_dir}")
        if not dry:
            os.rename(old_dir, new_dir)

def update_texts(dry):
    changed = 0
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if os.path.splitext(f)[1].lower() not in TEXT_EXTENSIONS:
                continue
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", newline="") as fh:
                    text = fh.read()
            except (UnicodeDecodeError, OSError):
                continue
            new_text, total = text, 0
            for old, new in ALL_OLD.items():
                new_text, n = TEXT_RE[old].subn(new, new_text)
                total += n
            if total:
                changed += 1
                say(f"  text  {path}: {total} replacement(s)")
                if not dry:
                    with open(path, "w", encoding="utf-8", newline="") as fh:
                        fh.write(new_text)
    if not changed:
        say("  no text files needed changes")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="show changes without making them")
    args = ap.parse_args()
    if args.dry_run:
        say("DRY RUN - nothing will be changed\n")
    say("== Renaming folders and files ==")
    rename_assets(args.dry_run)
    say("\n== Updating names inside text files ==")
    update_texts(args.dry_run)
    say("\nDone.")

if __name__ == "__main__":
    sys.exit(main())
