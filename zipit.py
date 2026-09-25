"""Bundle all source code into a downloadable zip (excludes deps and artifacts)."""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # /home/user
OUT = os.path.join(ROOT, 'cocktail-game', 'downloads', 'pour-source.zip')

EXCLUDE_DIRS = {'node_modules', '__pycache__', 'downloads', '.git', '.arena'}
EXCLUDE_EXT = {'.pyc', '.pyo'}
EXCLUDE_NAMES = {'pour-source.zip', 'package-lock.json'}

INCLUDE_ROOT_FILES = ['serve.py']
INCLUDE_DIRS = ['cocktail-game', 'build']
# inside cocktail-game we only want source, not node_modules/downloads
APP_WANTED = {'index.html', 'manifest.webmanifest', 'sw.js', 'README.md', 'package.json'}
APP_SUBDIRS = {'css', 'js', 'test', 'icons'}

count = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for rf in INCLUDE_ROOT_FILES:
        p = os.path.join(ROOT, rf)
        if os.path.exists(p):
            z.write(p, rf); count += 1

    # canonical compiled dataset (source for data.js and the PDF)
    rj = os.path.join(ROOT, 'recipes.json')
    if os.path.exists(rj):
        z.write(rj, 'recipes.json'); count += 1

    # build pipeline
    bdir = os.path.join(ROOT, 'build')
    for fn in sorted(os.listdir(bdir)):
        p = os.path.join(bdir, fn)
        if fn.endswith('.py') and os.path.isfile(p):
            z.write(p, 'build/' + fn); count += 1

    # app source
    adir = os.path.join(ROOT, 'cocktail-game')
    for fn in sorted(os.listdir(adir)):
        p = os.path.join(adir, fn)
        if fn in APP_WANTED and os.path.isfile(p):
            z.write(p, 'cocktail-game/' + fn); count += 1
        elif fn in APP_SUBDIRS and os.path.isdir(p):
            for base, dirs, files in os.walk(p):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                for f in sorted(files):
                    fp = os.path.join(base, f)
                    ext = os.path.splitext(f)[1].lower()
                    if f in EXCLUDE_NAMES or ext in EXCLUDE_EXT:
                        continue
                    z.write(fp, os.path.relpath(fp, ROOT)); count += 1

print('zip written:', OUT, os.path.getsize(OUT), 'bytes,', count, 'files')
