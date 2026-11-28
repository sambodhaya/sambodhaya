"""Build the site from its code and its content.

    python3 src/build.py                      (needs Node for npx esbuild)
    python3 src/build.py --accept-audio       after re-recording: the recordings match the text again
    python3 src/build.py --accept-audio u01-en u03-th     (only those recordings)

content/ holds what the temple says, edited through /admin: the lessons (content/lessons/U01.json ...), the source
identifiers (sources.json), the Library's notes (library.json), and the 3D temple's hall names, signs, boards, info
cards and story paintings (content/world/*.json).
This script
  - writes content/site.json for the 3D world (content/world/, plus the eight stories: each lesson's title with the
    description of its painting), and
  - builds index.html: the lessons and sources put in front of src/content.js, then src/app.jsx, compiled with
    esbuild and inlined into src/shell.html, and
  - copies what the site serves into dist/ (the 3D temple's src/*.js minified, its imports left as they are).
It stops with a plain message if a content file is broken, so a bad edit never reaches the site.
It warns (and goes on) when a story's spoken text no longer matches its 🎧 recording (content/audio-manifest.json).
"""
import hashlib, json, pathlib, re, shutil, subprocess, sys

ESBUILD = "esbuild@0.28.2"  # pinned: a new esbuild release must not change the site by itself

src = pathlib.Path(__file__).resolve().parent
root = src.parent
content = root / "content"

def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"content error in {path.relative_to(root)}: {e}")

def bilingual(obj):
    return isinstance(obj, dict) and obj and set(obj) <= {"th", "en"}

def need_texts(where, obj):
    """every {th, en} text has both languages"""
    if isinstance(obj, dict):
        if bilingual(obj):
            for k in ("th", "en"):
                if not isinstance(obj.get(k), str) or not obj[k].strip():
                    sys.exit(f"content error in {where}: the {'Thai' if k == 'th' else 'English'} text is empty")
        for k, v in obj.items():
            need_texts(where, v)
    elif isinstance(obj, list):
        for v in obj:
            need_texts(where, v)

# what a lesson may leave out (the admin writes such a field as empty, or leaves it out)
OPTIONAL = ("question", "life", "uncertainty", "safety", "boundary", "evidenceNote", "translationNote", "phrase", "media")

def tidy_lesson(u):
    """empty optional fields count as absent; a lesson without a question keeps question: null, as the site expects"""
    for k in OPTIONAL:
        v = u.get(k)
        if v in (None, "", {}, False) or (isinstance(v, dict) and not any(str(x).strip() for x in v.values())):
            if k == "question":
                u[k] = None  # (in its place: the site shows no question)
            elif k in u:
                del u[k]
    u.setdefault("question", None)
    for e in u.get("exercises", []):
        for k in [k for k, v in e.items() if v in (None, "", [])]:
            del e[k]
    return u

args = sys.argv[1:]
accept_audio = None  # None: only check; a set of recording names (empty: all of them) to accept as re-recorded
if args:
    if args[0] != "--accept-audio":
        sys.exit("usage: python3 src/build.py [--accept-audio [u01-en u03-th ...]]")
    accept_audio = {a.lower() for a in args[1:]}

lessons = sorted((tidy_lesson(load(p)) for p in (content / "lessons").glob("U*.json")), key=lambda u: u["code"])
sources = {s["key"]: {k: v for k, v in s.items() if k != "key"} for s in load(content / "sources.json")["sources"]}
library = load(content / "library.json")
w = content / "world"
signs = load(w / "signs.json")
world = {"places": load(w / "places.json"), "signs": {k: v for k, v in signs.items() if k != "garden_stones"},
         "garden_stones": signs["garden_stones"], "boards": load(w / "boards.json"), "cards": load(w / "cards.json")}
pictures = load(w / "stories.json")["pictures"]
for u in lessons:
    need_texts(f"lessons/{u.get('code', '?')}.json", u)
    for s in u.get("sources", []):
        if s.get("key") not in sources:
            sys.exit(f"content error in lessons/{u['code']}.json: unknown source key {s.get('key')!r}")
    for i, e in enumerate(u.get("exercises", []), 1):
        o, a = e.get("o"), e.get("a")
        if o is None and a is None:
            continue  # an open question or a challenge: no options to choose from
        if not isinstance(o, list) or not o:
            sys.exit(f"content error in lessons/{u['code']}.json: exercise {i} has an answer but no options")
        if not isinstance(a, int) or isinstance(a, bool) or not 0 <= a < len(o):
            sys.exit(f"content error in lessons/{u['code']}.json: exercise {i}'s answer (a = {a!r}) is not one of "
                     f"its {len(o)} options (the first is 0)")

# the lessons are U01 to U08, each once: the 🎧 recordings and the 3D story boards go by these codes
codes = [u.get("code") for u in lessons]
dupes = sorted({c for c in codes if codes.count(c) > 1})
if dupes:
    sys.exit(f"content error: more than one lesson has the code {', '.join(map(str, dupes))}")
want = [f"U{i:02d}" for i in range(1, 9)]
if codes != want:
    sys.exit(f"content error: the lessons must be exactly {', '.join(want)}; found {', '.join(map(str, codes))}")
for p in (content / "lessons").glob("U*.json"):
    if load(p).get("code") != p.stem:
        sys.exit(f"content error in lessons/{p.name}: its code must be {p.stem}")
missing = [f"audio/{c.lower()}-{l}.mp3" for c in codes for l in ("th", "en") if not (root / "audio" / f"{c.lower()}-{l}.mp3").is_file()]
if missing:
    sys.exit(f"missing recording(s): {', '.join(missing)}")

for name in ("places", "signs", "boards", "cards"):
    need_texts(f"world/{name}.json", world[name])
if not re.fullmatch(r"https://line\.me/[^\s/?#][^\s]*", str(signs.get("community", {}).get("url", ""))):
    sys.exit("content error in world/signs.json: the LINE OpenChat link (community.url) must be an invitation link, "
             "https://line.me/ followed by the rest of the link, with no spaces")
need_texts("world/stories.json", pictures)
if len(pictures) != len(lessons):
    sys.exit(f"content error: {len(lessons)} lessons but {len(pictures)} story paintings in world/stories.json")

# the 🎧 recordings speak each lesson's short story (`simple`: what the Listen button plays, and what the device's
# own voice reads if a recording can't play). The manifest keeps a fingerprint of the text each recording was made
# from; when the text changes, the recording no longer matches it and must be made again.
manifest_path = content / "audio-manifest.json"
MANIFEST_NOTE = ("Fingerprints (sha256, UTF-8, trimmed) of the text each 🎧 recording speaks: the lesson's `simple` "
                 "text (its short story) in Thai and English. The build warns when a lesson's text no longer matches "
                 "its recording. After re-recording, run: python3 src/build.py --accept-audio u01-en (the "
                 "recordings remade; with no names, all of them).")
def spoken(u, lang):
    return hashlib.sha256(u["simple"][lang].strip().encode("utf-8")).hexdigest()
manifest = load(manifest_path) if manifest_path.exists() else {}
heard = manifest.get("recordings", {})
stale = [f"{u['code'].lower()}-{l}" for u in lessons for l in ("th", "en") if heard.get(f"{u['code'].lower()}-{l}") != spoken(u, l)]
if accept_audio is not None:
    unknown = accept_audio - {f"{c.lower()}-{l}" for c in codes for l in ("th", "en")}
    if unknown:
        sys.exit(f"--accept-audio: no such recording {', '.join(sorted(unknown))} (they are named like u01-en)")
    for name in (accept_audio or stale):
        u = lessons[codes.index(name[:3].upper())]
        heard[name] = spoken(u, name[4:])
    manifest_path.write_text(json.dumps({"comment": MANIFEST_NOTE, "field": "simple", "recordings": dict(sorted(heard.items()))},
                                        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"audio: {', '.join(sorted(accept_audio or stale)) or 'nothing'} accepted as matching the text "
          f"(content/audio-manifest.json; commit it)")
    stale = [n for n in stale if n not in (accept_audio or stale)]
if stale:
    print("WARNING: the text of these stories has changed since they were recorded, so the 🎧 recording no longer says "
          "what the page shows. Remake them:\n" + "\n".join(f"  audio/{n}.mp3  (lessons/{n[:3].upper()}.json, simple."
          f"{n[4:]})" for n in stale) + "\nthen run: python3 src/build.py --accept-audio " + " ".join(stale))

# the 3D world
site = dict(world)
site["journey"] = [{"code": u["code"], "title": u["title"], "picture": pictures[i]} for i, u in enumerate(lessons)]
(content / "site.json").write_text(json.dumps(site, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# the 2D site
data = "".join(f"const {name} = {json.dumps(value, ensure_ascii=False)};\n" for name, value in
               (("SOURCES", sources), ("UNITS", lessons), ("AMBER", library["amber"]), ("WHEEL_IMAGE", library["wheel"]),
                ("COMMUNITY", signs["community"])))
combined = data + (src / "content.js").read_text(encoding="utf-8") + "\n" + (src / "app.jsx").read_text(encoding="utf-8")
js = subprocess.run(["npx", "--yes", ESBUILD, "--loader=jsx", "--minify", "--target=es2019"],
                    input=combined, check=True, capture_output=True, text=True).stdout
shell = (src / "shell.html").read_text(encoding="utf-8")
(root / "index.html").write_text(shell.replace("/*APP*/", js), encoding="utf-8")
print(f"wrote content/site.json and index.html ({len(lessons)} lessons)")

# what the site serves, and nothing else
PUBLIC = ["index.html", "world.html", "records.html", "robots.txt", "admin", "content", "src/world.js", "src/sound.js",
          "src/bamboo.js", "img", "assets", "audio", "vendor"]  # vendor/: three.js and three-vrm, published builds, copied as they are
PUBLIC += sorted(p.relative_to(root).as_posix() for p in (src / "world").rglob("*.js"))  # the modules world.js imports
dist = root / "dist"
shutil.rmtree(dist, ignore_errors=True)
for name in PUBLIC:
    a, b = root / name, dist / name
    b.parent.mkdir(parents=True, exist_ok=True)
    if name.startswith("src/") and name.endswith(".js"):
        # minified, not bundled: each module keeps its imports (the import map in world.html still resolves them)
        r = subprocess.run(["npx", "--yes", ESBUILD, "--minify", "--format=esm", "--target=es2022", f"--sourcefile={name}"],
                           input=a.read_text(encoding="utf-8"), capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"esbuild could not minify {name}:\n{r.stderr}")
        b.write_text(r.stdout, encoding="utf-8")
    else:
        (shutil.copytree if a.is_dir() else shutil.copy2)(a, b)
print("copied the site into dist/ (the 3D temple's scripts minified)")
