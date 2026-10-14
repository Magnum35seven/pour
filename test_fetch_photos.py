"""Offline tests for fetch_photos.py (no network): run with  python3 test_fetch_photos.py"""
import json, os, tempfile, unittest
import fetch_photos as fp


def info(lic, mime="image/jpeg", artist="<a href='x'>Jane &amp; Co</a>"):
    return {"thumburl": "https://upload.example/thumb.jpg", "mime": mime,
            "descriptionurl": "https://commons.example/File:X.jpg",
            "extmetadata": {"LicenseShortName": {"value": lic}, "Artist": {"value": artist},
                            "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0"}}}


class Fake(fp.Wikimedia):
    def __init__(self):
        super().__init__(delay=0)
        self.articles = {"Negroni": "Negroni.jpg", "Bad Drink": "Bad.jpg", "Pinned": None}
        self.files = {"File:Negroni.jpg": info("CC BY-SA 4.0"),
                      "File:Bad.jpg": info("CC BY-NC 4.0"),
                      "File:Mine.png": info("CC0", "image/png")}
        self.downloads = []

    def article_image(self, title):
        return self.articles.get(title)

    def file_info(self, ft, width):
        if not ft.lower().startswith("file:"): ft = "File:" + ft
        return (ft, self.files[ft]) if ft in self.files else None

    def search_files(self, text, width):
        return []

    def download(self, url, path):
        self.downloads.append(path)
        open(path, "wb").write(b"img")


class T(unittest.TestCase):
    def test_licence(self):
        for ok in ["CC BY 2.0", "CC BY-SA 4.0", "CC0", "Public domain", "PD-old-70", "CC BY-SA 3.0"]:
            self.assertTrue(fp.licence_ok(ok), ok)
        for bad in ["CC BY-NC 4.0", "CC BY-ND 2.0", "CC BY-NC-SA 3.0", "", None, "Fair use", "All rights reserved"]:
            self.assertFalse(fp.licence_ok(bad), bad)

    def test_strip_and_titles(self):
        self.assertEqual(fp.strip_html("<a href='x'>Jane &amp; Co</a>"), "Jane & Co")
        self.assertIn("Negroni (cocktail)", fp.title_candidates("Negroni"))
        self.assertIn("Naked & Famous", fp.title_candidates("Naked and Famous"))

    def test_run(self):
        with tempfile.TemporaryDirectory() as d:
            os.chdir(d)
            recipes = [{"id": "negroni", "name": "Negroni"}, {"id": "bad", "name": "Bad Drink"},
                       {"id": "none", "name": "Nothing Here"}, {"id": "pinned", "name": "Pinned"}]
            json.dump(recipes, open("recipes.json", "w"))
            json.dump({"pinned": "File:Mine.png"}, open("photo_overrides.json", "w"))
            wm = Fake()
            fp.main([], wm=wm)
            photos = json.load(open("photos.json"))
            self.assertEqual(sorted(photos), ["negroni", "pinned"])
            self.assertEqual(photos["negroni"]["credit"], "Jane & Co")
            self.assertEqual(photos["negroni"]["license"], "CC BY-SA 4.0")
            self.assertEqual(photos["negroni"]["file"], "img/negroni.jpg")
            self.assertEqual(photos["pinned"]["file"], "img/pinned.png")
            self.assertTrue(os.path.exists("img/negroni.jpg"))
            miss = open("photos_missing.txt").read()
            self.assertIn("Bad Drink", miss); self.assertIn("not reusable", miss)
            self.assertIn("Nothing Here", miss)
            # second run does not re-download what it already has
            wm.downloads.clear(); fp.main([], wm=wm)
            self.assertEqual(wm.downloads, [])
            os.chdir("/")


if __name__ == "__main__":
    unittest.main()
