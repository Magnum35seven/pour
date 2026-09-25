# Pour — Learn 119 Cocktails

A fully offline, installable PWA for learning the cocktail canon by *doing*: pick the glass, the ice,
the vessel, pour every ingredient to the exact line, choose the technique, the strain and the garnish —
and get scored. Every mistake is logged and turned into a personal drill. Beating the **Martini
Gauntlet** is the boss fight.

## Run it

```
python3 ../serve.py 8080      # from this folder's parent, or:
python3 serve.py 8080         # serve.py lives one level up and serves ./cocktail-game
```

Open `http://127.0.0.1:8080/`, or the sandbox preview URL. Add to home screen / install for the
standalone PWA. It works fully offline via a service worker.

Tests (real DOM, real app modules, via jsdom):

```
cd cocktail-game && node test/app.test.mjs    # 66 assertions
```

## What's in the data

- **119 recipes** = 93 from your uploaded guide **+ 26 IBA-official cocktails the guide was missing**,
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
2. **Library** – search + filter all 119 (by category, by source, by strength). Each recipe page shows
   the build, the alcohol panel, tasting notes, backstory and myth check.
3. **Play** – the round: glass → ice → vessel → prep → pours (hold-to-pour minigame, "feel mode" hides the
   number until you release) → method → timing → strain → garnish. Streak multiplier; everything wrong is
   logged to the taxonomy in `Mistakes`.
4. **Boss** – the Martini Gauntlet: 15 martini-family drinks, the boss has 100 HP, correct answers hurt
   it, wrong answers heal it.
5. **Cellar** – log drinks you've made or bought in real life (place, home/away, rating, notes);
   coverage, average rating and total ethanol for the record.

Everything is stored locally (localStorage). No accounts, no server, no analytics.

## Provenance / honesty

ABV figures are *computed* from labelled strengths (e.g. a 60/10 Dry Martini comes out ~31% as served, a
Zombie ~4.8 AU standard drinks) and are labelled as estimates. Backstories were cross-checked against the
IBA list and the cocktails' own records; anything contested (Margarita, Harvey Wallbanger, Pisco Punch,
Spicy Fifty, Illegal, …) is presented with its confidence grade and, where relevant, a myth check, rather
than a fabricated certainty.
