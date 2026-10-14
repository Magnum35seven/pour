#!/usr/bin/env python3
"""Collect licensed cocktail photos from Wikimedia Commons for the Pour app.

For each recipe it finds the lead image of the matching Wikipedia article, looks that
file up on Commons, and keeps it ONLY if the licence allows reuse (CC BY, CC BY-SA, CC0
or public domain; anything NonCommercial / NoDerivs is rejected). It downloads a
compressed copy into img/ and records the photographer, licence and source link in
photos.json, which the app shows as the on-screen credit.

Run it on your own computer (it needs internet access). Standard library only.

    python3 fetch_photos.py                 # every recipe that has no photo yet
    python3 fetch_photos.py --ids negroni,mojito
    python3 fetch_photos.py --limit 10      # try a few first
    python3 fetch_photos.py --search        # also try a Commons search when no article image is usable
    python3 fetch_photos.py --force         # re-fetch even if a photo is already recorded

To pin a specific image for a drink, add it to photo_overrides.json:
    { "negroni": "File:Negroni_served_in_Rome.jpg" }

Always glance at the results: an automatic match can occasionally be the wrong drink.
Remove a wrong one by deleting its entry from photos.json and its file from img/, then
pin the right file in photo_overrides.json. Credits must stay with the photos.
"""
import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "PourCocktailTrainer/1.0 (personal learning app; https://github.com/Magnum35seven/pour)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
OK_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

# Accept: CC BY / CC BY-SA (any version), CC0, public domain. Reject NC / ND variants.
_ACCEPT = re.compile(r"^(cc[ -]by([ -]sa)?[ -]\d|cc0|cc[ -]zero|public domain|pd([ -]|$))", re.I)
_REJECT = re.compile(r"(\bnc\b|-nc|\bnd\b|-nd|non-?commercial|no[ -]?deriv)", re.I)


def licence_ok(short_name):
    """True if a Commons LicenseShortName permits reuse with attribution."""
    s = (short_name or "").strip()
    return bool(s) and bool(_ACCEPT.search(s)) and not _REJECT.search(s)


def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def title_candidates(name):
    base = name.replace("\u2019", "'").strip()
    seen, out = set(), []
    for t in (base, f"{base} (cocktail)", f"{base} (drink)", base.replace(" and ", " & ")):
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


class Wikimedia:
    """Thin client. Tests replace get_json / download with fakes."""

    def __init__(self, delay=1.0):
        self.delay = delay

    def get_json(self, api, params):
        url = api + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = json.load(r)
                time.sleep(self.delay)
                return data
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                    continue
                raise
        return {}

    def download(self, url, path):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
        time.sleep(self.delay)

    # ---- lookups -------------------------------------------------------------
    def article_image(self, title):
        """Lead image file name (without 'File:') of a Wikipedia article, or None."""
        d = self.get_json(WIKI_API, {"action": "query", "titles": title, "redirects": "1",
                                      "prop": "pageimages", "piprop": "name"})
        for p in d.get("query", {}).get("pages", []):
            if not p.get("missing") and p.get("pageimage"):
                return p["pageimage"]
        return None

    def search_files(self, text, width):
        """Commons file search; returns a list of (file title, imageinfo)."""
        d = self.get_json(COMMONS_API, {
            "action": "query", "generator": "search", "gsrsearch": f"{text} cocktail",
            "gsrnamespace": "6", "gsrlimit": "6", "prop": "imageinfo",
            "iiprop": "url|extmetadata|mime", "iiurlwidth": str(width)})
        out = []
        for p in d.get("query", {}).get("pages", []):
            if p.get("imageinfo"):
                out.append((p["title"], p["imageinfo"][0]))
        return out

    def file_info(self, file_title, width):
        """imageinfo for a Commons file, or None if it is not on Commons."""
        if not file_title.lower().startswith("file:"):
            file_title = "File:" + file_title
        d = self.get_json(COMMONS_API, {"action": "query", "titles": file_title, "prop": "imageinfo",
                                         "iiprop": "url|extmetadata|mime", "iiurlwidth": str(width)})
        for p in d.get("query", {}).get("pages", []):
            if not p.get("missing") and p.get("imageinfo"):
                return file_title, p["imageinfo"][0]
        return None


def evaluate(file_title, info):
    """Return (record, None) if usable, else (None, reason)."""
    meta = info.get("extmetadata", {})
    lic = (meta.get("LicenseShortName") or {}).get("value", "")
    if not licence_ok(lic):
        return None, f"licence not reusable: '{lic or 'unknown'}'"
    mime = info.get("mime", "")
    if mime not in OK_MIME:
        return None, f"unsupported file type {mime}"
    artist = strip_html((meta.get("Artist") or {}).get("value", "")) or "Unknown author"
    return {
        "title": file_title,
        "credit": artist,
        "license": lic,
        "licenseUrl": (meta.get("LicenseUrl") or {}).get("value", ""),
        "source": info.get("descriptionurl", ""),
        "_url": info.get("thumburl") or info.get("url"),
        "_ext": OK_MIME[mime],
    }, None


def find_photo(wm, recipe, overrides, width, use_search):
    """Return (record, note). record is None when nothing usable was found."""
    rid, name = recipe["id"], recipe["name"]
    if rid in overrides:
        got = wm.file_info(overrides[rid], width)
        if not got:
            return None, f"override {overrides[rid]} not found on Commons"
        rec, why = evaluate(*got)
        return rec, (why if not rec else "pinned in photo_overrides.json")
    reasons = []
    for t in title_candidates(name):
        fname = wm.article_image(t)
        if not fname:
            continue
        got = wm.file_info(fname, width)
        if not got:
            reasons.append(f"{t}: lead image is not on Commons")
            continue
        rec, why = evaluate(*got)
        if rec:
            return rec, f"via Wikipedia article '{t}'"
        reasons.append(f"{t}: {why}")
    if use_search:
        for ftitle, info in wm.search_files(name, width):
            rec, why = evaluate(ftitle, info)
            if rec:
                return rec, "via Commons search (check it is the right drink)"
    return None, "; ".join(reasons) or "no Wikipedia article image found"


def main(argv=None, wm=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--recipes", default="recipes.json")
    ap.add_argument("--map", default="photos.json")
    ap.add_argument("--overrides", default="photo_overrides.json")
    ap.add_argument("--out", default="img")
    ap.add_argument("--width", type=int, default=640, help="thumbnail width in pixels")
    ap.add_argument("--ids", help="comma-separated recipe ids")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--search", action="store_true")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests (be polite)")
    args = ap.parse_args(argv)

    wm = wm or Wikimedia(args.delay)
    recipes = json.load(open(args.recipes, encoding="utf-8"))
    photos = json.load(open(args.map, encoding="utf-8")) if os.path.exists(args.map) else {}
    overrides = json.load(open(args.overrides, encoding="utf-8")) if os.path.exists(args.overrides) else {}
    only = set(args.ids.split(",")) if args.ids else None
    os.makedirs(args.out, exist_ok=True)

    todo = [r for r in recipes if (not only or r["id"] in only) and (args.force or r["id"] not in photos)]
    if args.limit:
        todo = todo[:args.limit]
    print(f"{len(todo)} recipes to look up ({len(photos)} already have photos)")

    got, missed = 0, []
    for n, r in enumerate(todo, 1):
        try:
            rec, note = find_photo(wm, r, overrides, args.width, args.search)
        except Exception as e:  # network hiccup: carry on with the rest
            rec, note = None, f"error: {e}"
        if not rec:
            missed.append((r["name"], note))
            print(f"[{n}/{len(todo)}] -- {r['name']}: {note}")
            continue
        path = os.path.join(args.out, f"{r['id']}.{rec['_ext']}")
        try:
            wm.download(rec["_url"], path)
        except Exception as e:
            missed.append((r["name"], f"download failed: {e}"))
            print(f"[{n}/{len(todo)}] -- {r['name']}: download failed: {e}")
            continue
        photos[r["id"]] = {k: v for k, v in rec.items() if not k.startswith("_")}
        photos[r["id"]]["file"] = path.replace(os.sep, "/")
        got += 1
        print(f"[{n}/{len(todo)}] ok {r['name']}  ({rec['license']}, {rec['credit']}) {note}")
        json.dump(dict(sorted(photos.items())), open(args.map, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    json.dump(dict(sorted(photos.items())), open(args.map, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"\nDone: {got} photos added, {len(missed)} without a usable photo. photos.json now has {len(photos)}.")
    if missed:
        with open("photos_missing.txt", "w", encoding="utf-8") as f:
            for name, why in missed:
                f.write(f"{name}: {why}\n")
        print("Reasons written to photos_missing.txt. Those drinks keep their drawn-glass picture.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
