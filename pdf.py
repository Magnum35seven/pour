"""Render the corrected, enriched guide to a downloadable PDF from recipes.json."""
import json, os, sys, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether, HRFlowable)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, '..', 'recipes.json'), encoding='utf-8'))
OUT = os.path.join(HERE, '..', 'cocktail-game', 'downloads', 'updated-cocktail-guide.pdf')

CAT_LABEL = {'unforgettables': 'The Unforgettables', 'contemporary': 'Contemporary Classics',
             'newera': 'New Era Drinks', 'noniba': 'Famous Non-IBA Classics & Cult Shooters'}
CAT_ORDER = ['unforgettables', 'contemporary', 'newera', 'noniba']

GOLD = colors.HexColor('#b8913a')
INK = colors.HexColor('#221e1a')
MUTE = colors.HexColor('#6b6257')
LINE = colors.HexColor('#d8d0c4')
AMBERBG = colors.HexColor('#faf6ec')


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def unit(i):
    q, u = i['q'], i['u']
    if u == 'ml':
        return f"{int(q) if float(q).is_integer() else q} mL"
    if u == 'dash':
        return f"{q} dash{'es' if q != 1 else ''}"
    if u == 'drop':
        return f"{q} drop{'s' if q != 1 else ''}"
    if u == 'pinch':
        return f"{q} pinch{'es' if q != 1 else ''}"
    if u == 'tsp':
        return f"{q} tsp"
    if u == 'barspoon':
        return f"{q} barspoon{'s' if q != 1 else ''}"
    if u == 'cube':
        return f"{q} sugar cube{'s' if q != 1 else ''}"
    if u == 'count':
        return f"{q}"
    if u in ('top', 'splash'):
        return 'to fill'
    return ''


def tech_text(t):
    names = {'shake': 'Shake', 'dry-shake': 'Dry shake', 'stir': 'Stir', 'muddle': 'Muddle',
             'blend': 'Blend', 'roll': 'Roll', 'float': 'Float', 'layer': 'Layer',
             'rinse': 'Rinse', 'rim': 'Rim', 'swizzle': 'Swizzle', 'soak': 'Soak',
             'build': 'Build', 'top': 'Top up', 'clap': 'Clap'}
    n = names.get(t['t'], t['t'])
    return f"{n} {t['s']}s" if t.get('s') else n


def build_styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle('pg_h1', fontName='Helvetica-Bold', fontSize=26, leading=31,
                          textColor=INK, spaceAfter=6))
    ss.add(ParagraphStyle('pg_sub', fontName='Helvetica', fontSize=11, leading=15, textColor=MUTE))
    ss.add(ParagraphStyle('pg_cat', fontName='Helvetica-Bold', fontSize=16, leading=20,
                          textColor=GOLD, spaceBefore=14, spaceAfter=8))
    ss.add(ParagraphStyle('pg_rt', fontName='Helvetica-Bold', fontSize=13, leading=16,
                          textColor=INK, spaceBefore=2, spaceAfter=2))
    ss.add(ParagraphStyle('pg_meta', fontName='Helvetica', fontSize=8.5, leading=11, textColor=MUTE))
    ss.add(ParagraphStyle('pg_lab', fontName='Helvetica-Bold', fontSize=8, leading=10,
                          textColor=GOLD, spaceBefore=6, spaceAfter=1))
    ss.add(ParagraphStyle('pg_body', fontName='Helvetica', fontSize=9, leading=12.5, textColor=INK))
    ss.add(ParagraphStyle('pg_ing', fontName='Helvetica', fontSize=9, leading=12, textColor=INK))
    ss.add(ParagraphStyle('pg_small', fontName='Helvetica', fontSize=7.5, leading=9.5, textColor=MUTE))
    ss.add(ParagraphStyle('pg_center', fontName='Helvetica', fontSize=9, textColor=MUTE,
                          alignment=TA_CENTER))
    return ss


def recipe_block(r, st):
    els = []
    name = esc(r['name'])
    if r.get('printedAs'):
        name += f"  <font size=8 color='#8a8074'>(guide prints “{esc(r['printedAs'])}”)</font>"
    els.append(Paragraph(name, st['pg_rt']))

    meta = [CAT_LABEL[r['cat']], r['family'], 'from your guide' if r['src'] == 'guide'
            else 'added from IBA 2024']
    els.append(Paragraph(' · '.join(esc(m) for m in meta), st['pg_meta']))

    # build line
    build = [f"Glass: {esc(r['glass'])}", f"Ice: {esc(r['icePrep'])}"]
    if r['iceServe'] != r['icePrep']:
        build.append(f"Served: {esc(r['iceServe'])}")
    build += [f"Vessel: {esc(r['vessel'])}", f"Strain: {esc(r['strain'])}"]
    build += [tech_text(t) for t in r['tech']]
    els.append(Paragraph('Build — ' + ' · '.join(build), st['pg_small']))

    # ingredients table
    rows = []
    for i in r['ings']:
        abv = f"{i['abv']}%" if i.get('abv') else ''
        rows.append([Paragraph(esc(unit(i)), st['pg_ing']),
                     Paragraph(esc(i['l']), st['pg_ing']),
                     Paragraph(abv, st['pg_ing'])])
    t = Table(rows, colWidths=[52, None, 34], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('BACKGROUND', (0, 0), (-1, -1), AMBERBG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    els.append(Spacer(1, 3))
    els.append(t)

    if r.get('garnish'):
        els.append(Paragraph(f"<b>Garnish:</b> {esc(r['garnish'])}", st['pg_small']))

    # alcohol strip
    a = r['abv']
    els.append(Paragraph(
        f"<b>Alcohol</b> — {a['abv_served']}% as served ({a['abv_pre']}% pre-dilution) · "
        f"{a['absolute_ml']} mL / {a['absolute_g']} g ethanol · "
        f"{a['std_au']} AU std drinks · {a['std_us']} US", st['pg_small']))

    # editorial
    els.append(Paragraph(f"<b>Tasting:</b> {esc(r['taste'])}", st['pg_body']))
    els.append(Paragraph(f"<b>Backstory</b> [{esc(r['conf'])} conf.]: {esc(r['story'])}", st['pg_body']))
    if r.get('myth'):
        els.append(Paragraph(f"<b>Myth check:</b> {esc(r['myth'])}", st['pg_body']))
    if r.get('flag'):
        els.append(Paragraph(f"<b>Source note:</b> {esc(r['flag'])}", st['pg_small']))
    els.append(Spacer(1, 10))
    return els


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTE)
    canvas.drawString(48, 24, 'Pour — the updated bartender’s guide')
    canvas.drawRightString(A4[0] - 48, 24, f"{doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.line(48, 34, A4[0] - 48, 34)
    canvas.restoreState()


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    st = build_styles()
    doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=48, rightMargin=48,
                            topMargin=52, bottomMargin=48, title='The Updated Master Bartender’s Guide')
    story = []

    # cover
    story.append(Spacer(1, 90))
    story.append(Paragraph('The Updated<br/>Master Bartender’s Guide', st['pg_h1']))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='40%', thickness=2, color=GOLD, hAlign='LEFT'))
    story.append(Spacer(1, 12))
    n_guide = sum(1 for r in DATA if r['src'] == 'guide')
    n_iba = sum(1 for r in DATA if r['src'] == 'iba2024')
    story.append(Paragraph(
        f"A corrected, fact-checked edition of your uploaded guide: {n_guide} recipes from the original "
        f"document plus {n_iba} official IBA cocktails it was missing, for complete coverage of the "
        f"{len(DATA)}-drink canon. Every entry carries precise measurements, glass, ice, technique, "
        f"garnish, computed absolute alcohol (AU &amp; US standard drinks), tasting notes and a sourced "
        f"backstory.", st['pg_sub']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        f"Generated {datetime.date.today().isoformat()} by the Pour app build pipeline.", st['pg_small']))
    story.append(PageBreak())

    # provenance page
    story.append(Paragraph('Provenance &amp; corrections', st['pg_cat']))
    story.append(Paragraph(
        "The original PDF claimed “120+” recipes and “102 IBA”. It actually contains 93 recipes; several "
        "entries carry typos, and the IBA categorisation used is from older list vintages. This edition "
        "renames “Brandiziac (Casino)” to Casino, de-duplicates “Fresh Fresh Cream” and “Cranberry Juice "
        "Juice”, reads the Manhattan bitters as 1 dash, and flags drinks removed from the IBA (Barracuda, "
        "Golden Dream, B-52, Kamikaze, Screwdriver, Vampiro). Alcohol figures are computed from each "
        "ingredient’s labelled strength and are estimates; contested origins are graded rather than "
        "asserted.", st['pg_body']))
    story.append(Spacer(1, 10))

    for cat in CAT_ORDER:
        recs = [r for r in DATA if r['cat'] == cat]
        story.append(PageBreak())
        story.append(Paragraph(f"{CAT_LABEL[cat]}  ({len(recs)})", st['pg_cat']))
        for r in recs:
            story.extend(recipe_block(r, st))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print('PDF written:', OUT, os.path.getsize(OUT), 'bytes,', doc.page if hasattr(doc, 'page') else '', 'pages')


if __name__ == '__main__':
    main()
