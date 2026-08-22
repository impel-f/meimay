import argparse
import gzip
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "public" / "data" / "kanji_data.json"
OUTPUT_PATH = ROOT / "public" / "data" / "kanji_compounds.json"
CACHE_DIR = ROOT / ".cache" / "meimay-data"
JMDICT_CACHE_PATH = CACHE_DIR / "JMdict_e.gz"
JMDICT_URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz"
JMDICT_PROJECT_URL = "https://www.edrdg.org/wiki/Main_Page.html"
JMDICT_LICENSE_URL = "https://www.edrdg.org/edrdg/licence.html"

HAN_WORD_PATTERN = re.compile(r"^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{2,3}$")
KANA_PATTERN = re.compile(r"^[\u3041-\u309fー]+$")
EXCLUDED_POS_PATTERN = re.compile(
    r"proper noun|given name|surname|family name|place name|company name|organization name|product name|work of art",
    re.IGNORECASE,
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def download(url: str, destination: Path):
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Meimay dictionary data builder/1.0"})
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.replace(destination)


def priority_score(tags):
    score_map = {
        "news1": 120,
        "ichi1": 120,
        "spec1": 110,
        "gai1": 100,
        "news2": 80,
        "ichi2": 80,
        "spec2": 70,
        "gai2": 60,
    }
    best = 0
    for tag in tags:
        normalized = (tag or "").strip()
        if normalized in score_map:
            best = max(best, score_map[normalized])
            continue
        frequency = re.fullmatch(r"nf(\d{2})", normalized)
        if frequency:
            best = max(best, 101 - int(frequency.group(1)))
    return best


def child_texts(node, tag):
    return [(child.text or "").strip() for child in node.findall(tag) if (child.text or "").strip()]


def has_excluded_pos(entry):
    values = []
    for sense in entry.findall("sense"):
        values.extend(child_texts(sense, "pos"))
        values.extend(child_texts(sense, "misc"))
        values.extend(child_texts(sense, "field"))
    return any(EXCLUDED_POS_PATTERN.search(value) for value in values)


def extract_glosses(entry, word, reading):
    glosses = []
    seen = set()
    for sense in entry.findall("sense"):
        writing_restrictions = set(child_texts(sense, "stagk"))
        reading_restrictions = set(child_texts(sense, "stagr"))
        if writing_restrictions and word not in writing_restrictions:
            continue
        if reading_restrictions and reading not in reading_restrictions:
            continue
        for node in sense.findall("gloss"):
            value = " ".join((node.text or "").split())
            if not value or value in seen:
                continue
            seen.add(value)
            glosses.append(value)
            if len(glosses) >= 6:
                return glosses
    return glosses


def extract_entry_candidates(entry):
    if has_excluded_pos(entry):
        return []

    writings = []
    for node in entry.findall("k_ele"):
        word = (node.findtext("keb") or "").strip()
        if not HAN_WORD_PATTERN.fullmatch(word):
            continue
        writings.append({
            "word": word,
            "priority": priority_score(child_texts(node, "ke_pri")),
        })

    readings = []
    for node in entry.findall("r_ele"):
        reading = (node.findtext("reb") or "").strip()
        if not KANA_PATTERN.fullmatch(reading):
            continue
        readings.append({
            "reading": reading,
            "restrictions": set(child_texts(node, "re_restr")),
            "priority": priority_score(child_texts(node, "re_pri")),
        })

    candidates = []
    for writing in writings:
        compatible = [
            reading for reading in readings
            if not reading["restrictions"] or writing["word"] in reading["restrictions"]
        ]
        if not compatible:
            continue
        compatible.sort(key=lambda item: (-item["priority"], len(item["reading"]), item["reading"]))
        selected = compatible[0]
        candidates.append({
            "word": writing["word"],
            "reading": selected["reading"],
            "score": max(writing["priority"], selected["priority"]),
            "glosses": extract_glosses(entry, writing["word"], selected["reading"]),
        })
    return candidates


def build_compounds(source_path: Path, max_per_kanji: int):
    master = load_json(MASTER_PATH)
    target_order = [str(row.get("漢字") or "").strip() for row in master]
    target_set = set(filter(None, target_order))
    candidates_by_kanji = defaultdict(dict)

    with gzip.open(source_path, "rb") as source:
        for _, entry in ET.iterparse(source, events=("end",)):
            if entry.tag != "entry":
                continue
            for candidate in extract_entry_candidates(entry):
                for kanji in set(candidate["word"]):
                    if kanji not in target_set:
                        continue
                    current = candidates_by_kanji[kanji].get(candidate["word"])
                    if current is None or candidate["score"] > current["score"]:
                        candidates_by_kanji[kanji][candidate["word"]] = candidate
            entry.clear()

    entries = {}
    for kanji in target_order:
        candidates = list(candidates_by_kanji.get(kanji, {}).values())
        candidates.sort(key=lambda item: (-item["score"], len(item["word"]), item["word"], item["reading"]))
        entries[kanji] = [
            {
                "word": item["word"],
                "reading": item["reading"],
                "common": item["score"] > 0,
                "glosses": item["glosses"],
            }
            for item in candidates[:max_per_kanji]
        ]

    return {
        "schemaVersion": 2,
        "source": {
            "name": "JMdict",
            "projectUrl": JMDICT_PROJECT_URL,
            "license": "CC BY-SA 4.0",
            "licenseUrl": JMDICT_LICENSE_URL,
        },
        "entries": entries,
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Reuse the cached JMdict archive")
    parser.add_argument("--max-per-kanji", type=int, default=24)
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.offline or not JMDICT_CACHE_PATH.exists():
        print("Downloading current JMdict...")
        download(JMDICT_URL, JMDICT_CACHE_PATH)
    if not JMDICT_CACHE_PATH.exists():
        raise FileNotFoundError(JMDICT_CACHE_PATH)

    output = build_compounds(JMDICT_CACHE_PATH, max(1, args.max_per_kanji))
    save_json(OUTPUT_PATH, output)
    covered = sum(1 for items in output["entries"].values() if items)
    compounds = sum(len(items) for items in output["entries"].values())
    common = sum(1 for items in output["entries"].values() for item in items if item["common"])
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
    print(json.dumps({"kanji": len(output["entries"]), "covered": covered, "compounds": compounds, "common": common}, ensure_ascii=False))


if __name__ == "__main__":
    main()
