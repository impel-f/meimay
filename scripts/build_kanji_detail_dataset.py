import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Tag


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
DATASET_PATH = DATA_DIR / "kanji_detail_dataset.json"
MASTER_PATH = DATA_DIR / "kanji_data.json"

JIGEN_DATA_URL = "https://jigen.net/data/{quoted}?type2=1"
JIGEN_BASE_URL = "https://jigen.net"
WIKTIONARY_URL = "https://ja.wiktionary.org/wiki/{quoted}"
USER_AGENT = "meimay-codex/1.0 (local kanji detail dataset builder)"

TITLE_ORIGIN = "\u6210\u308a\u7acb\u3061"
TITLE_MEANING = "\u610f\u5473\u306e\u6df1\u6398\u308a"
TITLE_IDIOMS = "\u4ee3\u8868\u7684\u306a\u719f\u8a9e"

JIGEN_STRUCTURE = "\u6f22\u5b57\u69cb\u6210"
JIGEN_IDIOM_SUFFIX = "\u306e\u719f\u8a9e"

WIKI_H2_KANJI = "\u6f22\u5b57"
WIKI_H3_ETYMOLOGY = "\u5b57\u6e90"
WIKI_H3_MEANING = "\u610f\u7fa9"

ORIGIN_TYPE_EXPLANATIONS = [
    ("\u4f1a\u610f\u5f62\u58f0", "\u610f\u5473\u3092\u8868\u3059\u8981\u7d20\u3068\u97f3\u306e\u624b\u304c\u304b\u308a\u3092\u4f75\u305b\u6301\u3064\u4f5c\u308a\u3067\u3059\u3002"),
    ("\u5f62\u58f0", "\u610f\u5473\u3092\u8868\u3059\u8981\u7d20\u3068\u97f3\u306e\u624b\u304c\u304b\u308a\u3092\u7d44\u307f\u5408\u308f\u305b\u305f\u4f5c\u308a\u3067\u3059\u3002"),
    ("\u4f1a\u610f", "\u8907\u6570\u306e\u8981\u7d20\u306e\u610f\u5473\u3092\u5408\u308f\u305b\u3066\u5b57\u7fa9\u3092\u793a\u3059\u4f5c\u308a\u3067\u3059\u3002"),
    ("\u6307\u4e8b", "\u8a18\u53f7\u7684\u306a\u5370\u3092\u52a0\u3048\u3066\u6982\u5ff5\u3092\u793a\u3059\u4f5c\u308a\u3067\u3059\u3002"),
    ("\u8c61\u5f62", "\u7269\u306e\u5f62\u3092\u304b\u305f\u3069\u3063\u3066\u5b57\u7fa9\u3092\u793a\u3059\u4f5c\u308a\u3067\u3059\u3002"),
    ("\u4eee\u501f", "\u5143\u306e\u5b57\u3092\u97f3\u5024\u306e\u8fd1\u3044\u5225\u306e\u8a9e\u306b\u8ee2\u7528\u3057\u305f\u4f5c\u308a\u3067\u3059\u3002"),
]


def load_json(path: Path):
  return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
  path.write_text(
      json.dumps(data, ensure_ascii=False, indent=2) + "\n",
      encoding="utf-8",
  )


def clean(value):
  return str(value or "").strip()


def normalize_space(text: str):
  return re.sub(r"\s+", " ", clean(text))


def safe_label(text: str):
  encoding = sys.stdout.encoding or "utf-8"
  try:
    text.encode(encoding)
    return text
  except UnicodeEncodeError:
    return text.encode("unicode_escape").decode()


def truncate_sentence(text: str, limit: int):
  text = normalize_space(text)
  if len(text) <= limit:
    return text
  for sep in ("\u3002", "\u3001"):
    idx = text.find(sep)
    if 0 < idx + 1 <= limit:
      return text[: idx + 1]
  return text[:limit].rstrip("\u3001\u3002") + "\u3002"


def trim_parenthetical(text: str):
  text = normalize_space(text)
  text = re.sub(r"/\*.*?\*/", "", text)
  text = re.sub(r"/\*[^ ]*/", "", text)
  text = re.sub(r"\uff08[^\uff09]*\uff09", "", text)
  text = re.sub(r"\s+\u3002", "\u3002", text)
  text = re.sub(r"\s+", " ", text)
  text = text.replace("\u300c ", "\u300c").replace(" \u300d", "\u300d")
  return text.strip(" \u3002")


def direct_list_item_text(item: Tag):
  chunks = []
  for child in item.contents:
    if isinstance(child, Tag) and child.name in ("ul", "ol"):
      continue
    if isinstance(child, Tag):
      chunks.append(normalize_space(child.get_text(" ", strip=True)))
    else:
      chunks.append(normalize_space(str(child)))
  return normalize_space(" ".join(chunk for chunk in chunks if chunk))


def shorten_meaning_item(text: str):
  text = normalize_space(text)
  text = re.sub(r"\s*[\uff08(][^\uff09)]*[\uff09)]", "", text)
  text = text.replace("\u5bfe\u7fa9\u5b57\uff1a", "")
  text = text.replace("\u5bfe\u7fa9\u5b57:", "")
  text = text.replace("\u3002", "\u30fb")
  text = text.replace("\u3001", "\u30fb")
  text = re.sub(r"\u30fb{2,}", "\u30fb", text)
  return text.strip("\u30fb ")


def fit_text(candidates: list[str], minimum: int = 50, maximum: int = 80):
  picked = []
  for candidate in candidates:
    candidate = normalize_space(candidate)
    if not candidate:
      continue
    next_text = "".join(picked + [candidate])
    if len(next_text) <= maximum:
      picked.append(candidate)

  if not picked and candidates:
    picked = [truncate_sentence(normalize_space(candidates[0]), maximum)]

  text = "".join(picked)
  if len(text) >= minimum:
    return text if len(text) <= maximum else truncate_sentence(text, maximum)

  for candidate in candidates[len(picked):]:
    candidate = normalize_space(candidate)
    if not candidate:
      continue
    extra = text + candidate
    if len(extra) <= maximum:
      text = extra
    if len(text) >= minimum:
      break

  if len(text) > maximum:
    text = truncate_sentence(text, maximum)
  return text


def origin_type_explanation(origin_type: str):
  normalized = normalize_space(origin_type).replace(" ", "")
  for key, text in ORIGIN_TYPE_EXPLANATIONS:
    if key in normalized:
      return text
  return ""


def make_session():
  session = requests.Session()
  session.headers.update({"User-Agent": USER_AGENT})
  return session


def fetch_soup(session: requests.Session, url: str):
  response = session.get(url, timeout=20)
  response.raise_for_status()
  return BeautifulSoup(response.text, "html.parser")


def extract_jigen_kanji_url(session: requests.Session, kanji: str):
  soup = fetch_soup(session, JIGEN_DATA_URL.format(quoted=quote(kanji)))
  href = next((a["href"] for a in soup.find_all("a", href=True) if "/kanji/" in a["href"]), None)
  return JIGEN_BASE_URL + href if href else None


def parse_jigen_kanji(session: requests.Session, kanji: str):
  url = extract_jigen_kanji_url(session, kanji)
  if not url:
    return None

  soup = fetch_soup(session, url)
  container = soup.find("div", id="kjid")
  if not container:
    return None

  info = {
      "url": url,
      "origin_type": "",
      "structure": "",
      "footnotes": [],
      "idioms": [],
  }

  for dt in container.find_all("dt"):
    title = normalize_space(dt.get_text(" ", strip=True))
    dd = dt.find_next_sibling("dd")
    if not dd:
      continue

    dd_text = normalize_space(" ".join(dd.stripped_strings))
    if title == TITLE_ORIGIN:
      info["origin_type"] = re.sub(r"\s*#\d+", "", dd_text).strip()
      refs = re.findall(r"#(\d+)", dd_text)
      for ref in refs:
        node = soup.find(id=f"gc_{ref}")
        if not node:
          continue
        note = re.sub(r"^#\d+\s*", "", normalize_space(node.get_text(" ", strip=True)))
        if note:
          info["footnotes"].append(note)
    elif title == JIGEN_STRUCTURE:
      info["structure"] = dd_text
    elif title.endswith(JIGEN_IDIOM_SUFFIX):
      for anchor in dd.find_all("a", href=True):
        word = normalize_space(anchor.get_text(" ", strip=True))
        if not word or len(word) not in (2, 3):
          continue
        info["idioms"].append({
            "word": word,
            "url": JIGEN_BASE_URL + anchor["href"],
        })

  return info


def parse_jigen_idiom(session: requests.Session, url: str):
  soup = fetch_soup(session, url)
  word_node = soup.find("h2")
  dl_node = soup.find("dl", class_="rss") or soup.find("dl", class_="slist") or soup.find("dl")
  if not word_node or not dl_node:
    return None

  dds = dl_node.find_all("dd", recursive=False)
  if len(dds) < 2:
    return None

  word = normalize_space(word_node.get_text(" ", strip=True))
  reading = normalize_space(dds[0].get_text(" ", strip=True))
  meaning = truncate_sentence(normalize_space(dds[1].get_text(" ", strip=True)), 40).rstrip("\u3002")
  if not word or not reading or not meaning:
    return None

  return {"word": word, "reading": reading, "meaning": meaning, "url": url}


def parse_wiktionary(session: requests.Session, kanji: str):
  url = WIKTIONARY_URL.format(quoted=quote(kanji))
  soup = fetch_soup(session, url)
  h2 = soup.find("h2", id=WIKI_H2_KANJI)
  out = {"url": url, "etymology": [], "meanings": []}
  if not h2:
    return out

  current_h3 = None
  for tag in h2.find_all_next():
    if isinstance(tag, Tag) and tag.name == "h2" and tag is not h2:
      break
    if not isinstance(tag, Tag):
      continue
    if tag.name == "h3":
      current_h3 = normalize_space(tag.get_text(" ", strip=True))
    elif tag.name in ("ul", "ol") and current_h3 in (WIKI_H3_ETYMOLOGY, WIKI_H3_MEANING):
      items = [direct_list_item_text(li) for li in tag.find_all("li", recursive=False)]
      items = [item for item in items if item]
      if current_h3 == WIKI_H3_ETYMOLOGY:
        out["etymology"].extend(items)
      else:
        out["meanings"].extend(items)

  return out


def build_origin_text(jigen_info, wiki_info):
  origin_type = clean(jigen_info.get("origin_type")) if jigen_info else ""
  structure = clean(jigen_info.get("structure")) if jigen_info else ""
  footnotes = list(jigen_info.get("footnotes", [])) if jigen_info else []
  wiki_etymology = list(wiki_info.get("etymology", [])) if wiki_info else []

  intro_parts = []
  if origin_type:
    origin_type = origin_type.replace(" ", "\u30fb")
    label = origin_type if "\u5b57" in origin_type else f"{origin_type}\u5b57"
    intro_parts.append(f"\u5b57\u6e90\u3067\u306f{label}\u3068\u3055\u308c\u3001")
    explanation = origin_type_explanation(origin_type)
    if explanation:
      intro_parts.append(explanation)
  elif wiki_etymology:
    wiki_explanation = origin_type_explanation(wiki_etymology[0])
    if wiki_explanation:
      intro_parts.append(wiki_explanation)
  if structure:
    intro_parts.append(f"\u6f22\u5b57\u69cb\u6210\u306f{structure}\u3068\u6574\u7406\u3055\u308c\u3066\u3044\u307e\u3059\u3002")

  note_text = ""
  if footnotes:
    note = truncate_sentence(trim_parenthetical(footnotes[0]), 32).rstrip("\u3002")
    if note:
      note_text = f"\u811a\u6ce8\u3067\u306f{note}\u3068\u3055\u308c\u307e\u3059\u3002"
  elif wiki_etymology:
    note = truncate_sentence(trim_parenthetical(wiki_etymology[0]), 32).rstrip("\u3002")
    if note:
      note_text = f"\u5b57\u6e90\u6ce8\u3067\u306f{note}\u3068\u3055\u308c\u307e\u3059\u3002"

  candidates = []
  intro_text = normalize_space("".join(intro_parts))
  if intro_text:
    candidates.append(intro_text)
  if note_text:
    candidates.append(note_text)

  return fit_text(candidates, minimum=50, maximum=80)


def build_meaning_text(wiki_info):
  meanings = [shorten_meaning_item(item) for item in wiki_info.get("meanings", [])]
  meanings = [item for item in meanings if item]
  unique_meanings = []
  for item in meanings:
    if item not in unique_meanings:
      unique_meanings.append(item)

  selected = unique_meanings[:3]
  if not selected:
    return ""

  if len(selected) >= 3:
    text = (
        f"\u5b57\u7fa9\u306b\u306f\u300c{selected[0]}\u300d\u300c{selected[1]}\u300d"
        f"\u300c{selected[2]}\u300d\u306a\u3069\u304c\u3042\u308a\u3001"
        "\u53e4\u304f\u304b\u3089\u3053\u306e\u5b57\u306e\u57fa\u672c\u7684\u306a\u610f\u5473\u3068\u3057\u3066\u7528\u3044\u3089\u308c\u3066\u304d\u307e\u3057\u305f\u3002"
    )
    if len(text) <= 80:
      return text

  if len(selected) >= 2:
    text = (
        f"\u5b57\u7fa9\u306b\u306f\u300c{selected[0]}\u300d\u300c{selected[1]}\u300d\u304c\u3042\u308a\u3001"
        "\u53e4\u304f\u304b\u3089\u3053\u306e\u5b57\u306e\u57fa\u672c\u7684\u306a\u610f\u5473\u3068\u3057\u3066\u7528\u3044\u3089\u308c\u3066\u304d\u307e\u3057\u305f\u3002"
    )
    if len(text) <= 80:
      return text

  return fit_text(
      [
          f"\u5b57\u7fa9\u306f\u300c{selected[0]}\u300d\u3092\u8868\u3057\u3001"
          "\u53e4\u304f\u304b\u3089\u3053\u306e\u5b57\u306e\u57fa\u672c\u7684\u306a\u610f\u5473\u3068\u3057\u3066\u7528\u3044\u3089\u308c\u3066\u304d\u307e\u3057\u305f\u3002"
      ],
      minimum=50,
      maximum=80,
  )


def get_existing_section_text(existing_entry: dict, title: str):
  for section in existing_entry.get("sections", []):
    if clean(section.get("title")) == title:
      return clean(section.get("text"))
  return ""


def build_idiom_lines(session: requests.Session, jigen_info, max_items: int):
  lines = []
  seen_words = set()
  for item in jigen_info.get("idioms", []):
    word = item["word"]
    if word in seen_words:
      continue
    seen_words.add(word)
    detail = parse_jigen_idiom(session, item["url"])
    if not detail:
      continue
    lines.append(f"{detail['word']}\uff08{detail['reading']}\uff09\uff1a{detail['meaning']}")
    if len(lines) >= max_items:
      break
    time.sleep(0.05)
  return lines


def build_entry(session: requests.Session, kanji: str, existing_entry: dict, max_idioms: int):
  jigen_info = parse_jigen_kanji(session, kanji)
  wiki_info = parse_wiktionary(session, kanji)

  sections = []

  origin_text = build_origin_text(jigen_info, wiki_info)
  if origin_text:
    sections.append({"title": TITLE_ORIGIN, "text": origin_text})

  meaning_text = build_meaning_text(wiki_info)
  if meaning_text:
    sections.append({"title": TITLE_MEANING, "text": meaning_text})

  idiom_lines = build_idiom_lines(session, jigen_info, max_items=max_idioms) if jigen_info else []
  if idiom_lines:
    sections.append({"title": TITLE_IDIOMS, "text": "\n".join(idiom_lines)})

  entry = {"sections": sections}
  reading_reasons = existing_entry.get("readingReasons", {}) if isinstance(existing_entry, dict) else {}
  if reading_reasons:
    entry["readingReasons"] = reading_reasons

  source_meta = {}
  if jigen_info and jigen_info.get("url"):
    source_meta["origin"] = jigen_info["url"]
  if wiki_info and wiki_info.get("url"):
    source_meta["meaning"] = wiki_info["url"]
  if source_meta:
    entry["sources"] = source_meta

  return entry


def parse_args():
  parser = argparse.ArgumentParser()
  parser.add_argument("--chars", nargs="*", help="Specific kanji to rebuild")
  parser.add_argument("--limit", type=int, default=0, help="Process only the first N kanji")
  parser.add_argument("--max-idioms", type=int, default=3, help="Max source-backed idioms per kanji")
  parser.add_argument("--sleep", type=float, default=0.15, help="Delay between kanji requests")
  return parser.parse_args()


def main():
  args = parse_args()
  existing = load_json(DATASET_PATH) if DATASET_PATH.exists() else {}
  master = load_json(MASTER_PATH)

  if args.chars:
    target_chars = args.chars
  else:
    target_chars = [row["\u6f22\u5b57"] for row in master]
    if args.limit > 0:
      target_chars = target_chars[: args.limit]

  session = make_session()
  output = dict(existing)
  failures = []

  for index, kanji in enumerate(target_chars, start=1):
    try:
      output[kanji] = build_entry(
          session,
          kanji,
          existing.get(kanji, {}),
          max_idioms=args.max_idioms,
      )
      print(f"[{index}/{len(target_chars)}] {safe_label(kanji)} OK")
    except Exception as error:  # noqa: BLE001
      failures.append({"kanji": kanji, "error": str(error)})
      print(f"[{index}/{len(target_chars)}] {safe_label(kanji)} FAIL: {error}")
    time.sleep(args.sleep)

  save_json(DATASET_PATH, output)
  print(f"Updated entries: {len(target_chars) - len(failures)} / {len(target_chars)}")
  if failures:
    print(json.dumps(failures[:20], ensure_ascii=False, indent=2))


if __name__ == "__main__":
  main()
