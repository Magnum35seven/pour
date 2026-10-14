# Pour — Learn 121 Cocktails

A fully offline, installable PWA for learning the cocktail canon by *doing*: pick the glass, the ice,
the vessel, pour every ingredient to the exact line, choose the technique, the strain and the garnish —
and get scored. Every mistake is logged and turned into a personal drill. Beating the **Martini
Gauntlet** is the boss fight.

## Run it

The project is a flat folder (no build step). Serve it with any static server:

```
python3 -m http.server 8080      # then open http://127.0.0.1:8080/
```

(`serve.py` also works.) Add to home screen / install for the standalone PWA. It works fully offline via
a service worker, and **updates itself**: it fetches fresh files whenever you are online, so every
commit you push appears the next time the app is opened. Only bump `VERSION` in `sw.js` if you want to
force-purge old cached files.

Tests (real DOM, real app modules, via jsdom):

```
npm install
node app.test.mjs                # app, finder, art, service-worker file list
python3 test_fetch_photos.py     # the photo collector, offline
```

## What's in the data

- **121 recipes** = 93 from your uploaded guide **+ 26 IBA-official cocktails the guide was missing +
  2 popular extras** (Amaretto Sour, Picante de la Casa),
  so the current 102-drink IBA list is fully covered (the guide only contained ~75 of them; see below).
- Every recipe carries: ingredients (mL/dashes with labelled ABV per ingredient), glass, prep ice,
  serve ice, vessel, technique(s) with timings, strain, garnish, family.
- **Alcohol panel, computed** per recipe from each ingredient's labelled strength:
  absolute alcohol (mL + grams), ABV before dilution and as served (modelled dilution by technique),
  and **AU standard drinks** (10 g) and US (14 g).
- **Editorial layer**: a backstory, tasting notes and a "myth check" for every recipe, each tagged with
  a confidence grade (high / medium / low) so folklore is flagged rather than stated as fact.

### Source corrections to your guide

The PDF claimed "120+" and "102 IBA". In practice it contains 93 recipes, and several entries carry
typos or use the guide's own (older) IBA categorisation. Where the guide is wrong or ambiguous the app
shows a **Source note**:

- `Brandiziac (Casino)` → renamed **Casino** (the guide's name is not a drink).
- `Alexander` "Fresh Fresh Cream", `Cosmopolitan` "Cranberry Juice Juice" → de-duplicated.
- `Manhattan` bitters "1 –" → read as 1 dash per IBA.
- `Zombie` differs from the current IBA spec (noted).
- `Barracuda`, `Golden Dream` (removed 2024), `B-52`, `Kamikaze`, `Screwdriver`, `Vampiro` (removed 2020)
  are kept but flagged as former IBA drinks.
- `Aperol Spritz` = IBA "Spritz"; `Pisco Sour`/`Vesper` now Contemporary; `Southside` re-added 2024.

The 26 added IBA drinks: Brandy Crusta, Remember the Maine, Cardinale, Corpse Reviver #2, Garibaldi,
Rabo de Galo, Bee's Knees, Canchanchara, Chartreuse Swizzle, Don's Special Daiquiri, Fernandito, Gin
Basil Smash, Grand Margarita, IBA Tiki, Illegal, Jungle Bird, Missionary's Downfall, New York Sour, Old
Cuban, Pisco Punch, Sherry Cobbler, Suffering Bastard, Three Dots and a Dash, Tipperary, Trinidad Sour,
Ve.n.to.

## The game

1. **Drill** – a daily queue weighted by what you've never tried and where you keep erring; XP, ranks,
   badges, decision- and pour-accuracy.
2. **Library** – search + filter all 121 (by category, by source, by strength). Each recipe page shows
   the build, the alcohol panel, tasting notes, backstory and myth check.
3. **My bar** – tap the ingredients you own to see what you can make now, what is one ingredient away,
   and what to buy next (it names the single bottle that unlocks the most drinks). Switch to *Contains*
   to list every cocktail that uses an ingredient; ingredient names on a recipe page link straight to it.
   Entirely local: no API, no key, works offline.
4. **Play** – the round: glass → ice → vessel → prep → pours (hold-to-pour minigame, "feel mode" hides the
   number until you release) → method → timing → strain → garnish. Streak multiplier; everything wrong is
   logged to the taxonomy in `Mistakes`.
5. **Boss** – the Martini Gauntlet: 15 martini-family drinks, the boss has 100 HP, correct answers hurt
   it, wrong answers heal it.
6. **Cellar** – log drinks you've made or bought in real life (place, home/away, rating, notes);
   coverage, average rating and total ethanol for the record.

## Pictures

Every recipe shows a **drawn glass** generated from its own data (glass type, ice, ingredient colours,
garnish), so nothing is ever blank. Real photos are optional and licence-checked:

```
python3 fetch_photos.py --limit 10     # try a few first
python3 fetch_photos.py                # then the rest
```

`fetch_photos.py` finds each drink's Wikipedia lead image, looks it up on Wikimedia Commons, and keeps it
**only** if the licence is CC BY, CC BY-SA, CC0 or public domain (NonCommercial / NoDerivs are rejected).
It saves a compressed copy in `img/` and records photographer, licence and source link in `photos.json`;
the app displays that credit under the photo. Drinks with no usable photo are listed in
`photos_missing.txt` and keep the drawn glass. Check the results by eye (a match can occasionally be the
wrong drink) and pin a better file in `photo_overrides.json`, e.g. `{ "negroni": "File:Name.jpg" }`.
Commit `img/` and `photos.json` together.

Everything is stored locally (localStorage). No accounts, no server, no analytics.

## Provenance / honesty

ABV figures are *computed* from labelled strengths (e.g. a 60/10 Dry Martini comes out ~31% as served, a
Zombie ~4.8 AU standard drinks) and are labelled as estimates. Backstories were cross-checked against the
IBA list and the cocktails' own records; anything contested (Margarita, Harvey Wallbanger, Pisco Punch,
Spicy Fifty, Illegal, …) is presented with its confidence grade and, where relevant, a myth check, rather
than a fabricated certainty.
