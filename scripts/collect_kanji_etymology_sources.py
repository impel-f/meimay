import argparse
import hashlib
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup, Tag


ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "public" / "data" / "kanji_data.json"
FACTS_PATH = ROOT / "public" / "data" / "kanji_etymology_facts.json"
OUTPUT_PATH = ROOT / "scripts" / "data" / "kanji_etymology_source_index.json"
CACHE_ROOT = ROOT / ".cache" / "meimay-data" / "etymology-sources"
KANJIPEDIA_CACHE = CACHE_ROOT / "kanjipedia"
JIGEN_CACHE = CACHE_ROOT / "jigen"

KANJIPEDIA_SEARCH_URL = "https://www.kanjipedia.jp/search"
KANJIPEDIA_BASE_URL = "https://www.kanjipedia.jp"
JIGEN_SEARCH_URL = "https://jigen.net/data/{quoted}?type2=1"
JIGEN_BASE_URL = "https://jigen.net"
USER_AGENT = "Meimay dictionary source verifier/1.0"
FORMATION_TYPES = ("会意形声", "会意兼形声", "形声", "会意", "象形", "指事", "仮借")

_thread_local = threading.local()


def load_json(path: Path, fallback=None):
  if not path.exists():
    return fallback
  return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value):
  path.parent.mkdir(parents=True, exist_ok=True)
  temporary = path.with_suffix(path.suffix + ".tmp")
  temporary.write_text(
      json.dumps(value, ensure_ascii=False, indent=2) + "\n",
      encoding="utf-8",
  )
  for attempt in range(8):
    try:
      temporary.replace(path)
      return
    except PermissionError:
      if attempt == 7:
        raise
      time.sleep(0.15 * (attempt + 1))


def clean(value):
  return re.sub(r"\s+", " ", str(value or "")).strip()


def cache_path(directory: Path, kanji: str):
  codepoints = "-".join(f"{ord(char):x}" for char in kanji)
  return directory / f"{codepoints}.json"


def get_session():
  session = getattr(_thread_local, "session", None)
  if session is None:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    _thread_local.session = session
  return session


def fetch_text(url: str, *, params=None, attempts=4):
  last_error = None
  for attempt in range(attempts):
    try:
      time.sleep(0.12)
      response = get_session().get(url, params=params, timeout=25)
      response.raise_for_status()
      if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
      return response.text
    except requests.RequestException as error:
      last_error = error
      if attempt + 1 < attempts:
        time.sleep(0.8 * (attempt + 1))
  raise last_error


def extract_text_with_image_markers(node: Tag):
  clone = BeautifulSoup(str(node), "html.parser")
  unresolved = []
  for image in clone.find_all("img"):
    alt = clean(image.get("alt"))
    if alt:
      image.replace_with(alt)
      continue
    source = clean(image.get("src"))
    marker = f"〔画像部品:{Path(source).stem or 'unknown'}〕"
    unresolved.append(marker)
    image.replace_with(marker)
  return clean(clone.get_text(" ", strip=True)), unresolved


def extract_formation_types(text: str):
  found = []
  normalized = clean(text)
  pattern = "|".join(re.escape(item) for item in FORMATION_TYPES)
  for match in re.finditer(pattern, normalized):
    item = match.group(0)
    canonical = "会意形声" if item == "会意兼形声" else item
    if canonical not in found:
      found.append(canonical)
  return found


def collect_kanjipedia(kanji: str, refresh=False):
  destination = cache_path(KANJIPEDIA_CACHE, kanji)
  if destination.exists() and not refresh:
    return load_json(destination, {})

  search_html = fetch_text(
      KANJIPEDIA_SEARCH_URL,
      params={"k": kanji, "kt": "1", "sk": "perfect"},
  )
  search_soup = BeautifulSoup(search_html, "html.parser")
  page_url = ""
  for anchor in search_soup.select('a[href^="/kanji/"]'):
    if clean(anchor.get_text(" ", strip=True)) == kanji:
      page_url = urljoin(KANJIPEDIA_BASE_URL, anchor.get("href"))
      break

  result = {
      "kanji": kanji,
      "url": page_url,
      "formationTypes": [],
      "originText": "",
      "unresolvedGlyphs": [],
      "status": "not_found" if not page_url else "missing_origin",
  }
  if page_url:
    page_html = fetch_text(page_url)
    page_soup = BeautifulSoup(page_html, "html.parser")
    origin_node = page_soup.select_one("li.naritachi > div:last-child > p")
    if origin_node:
      origin_text, unresolved = extract_text_with_image_markers(origin_node)
      result.update({
          "originText": origin_text,
          "formationTypes": extract_formation_types(origin_text),
          "unresolvedGlyphs": unresolved,
          "status": "ok" if origin_text else "missing_origin",
      })

  save_json(destination, result)
  return result


def collect_jigen(kanji: str, existing_fact: dict, refresh=False):
  destination = cache_path(JIGEN_CACHE, kanji)
  if destination.exists() and not refresh:
    return load_json(destination, {})

  existing_sources = existing_fact.get("sources", []) if existing_fact else []
  existing_url = next((
      source.get("url", "")
      for source in existing_sources
      if "jigen.net" in source.get("url", "") and source.get("kind") == "etymology"
  ), "")
  existing_types = list(existing_fact.get("formationTypes", [])) if existing_fact else []

  result = {
      "kanji": kanji,
      "url": existing_url,
      "formationTypes": existing_types,
      "status": "ok" if existing_url and existing_types else "not_found",
  }
  if not existing_url or not existing_types or refresh:
    search_html = fetch_text(JIGEN_SEARCH_URL.format(quoted=quote(kanji)))
    search_soup = BeautifulSoup(search_html, "html.parser")
    anchor = next((
        item for item in search_soup.select('a[href*="/kanji/"]')
        if clean(item.get_text(" ", strip=True)) == kanji
    ), None)
    page_url = urljoin(JIGEN_BASE_URL, anchor.get("href")) if anchor else ""
    result.update({"url": page_url, "formationTypes": [], "status": "not_found"})
    if page_url:
      page_html = fetch_text(page_url)
      page_soup = BeautifulSoup(page_html, "html.parser")
      container = page_soup.find("div", id="kjid")
      origin_text = ""
      if container:
        for title_node in container.find_all("dt"):
          if clean(title_node.get_text(" ", strip=True)) != "成り立ち":
            continue
          detail_node = title_node.find_next_sibling("dd")
          origin_text = clean(detail_node.get_text(" ", strip=True)) if detail_node else ""
          break
      result.update({
          "formationTypes": extract_formation_types(origin_text),
          "status": "ok" if origin_text else "missing_origin",
      })

  save_json(destination, result)
  return result


def summarize_source(source: dict):
  origin_text = clean(source.get("originText"))
  return {
      "url": clean(source.get("url")),
      "formationTypes": list(source.get("formationTypes", [])),
      "status": clean(source.get("status")),
      "hasUnresolvedGlyph": bool(source.get("unresolvedGlyphs")),
      "sourceHash": hashlib.sha256(origin_text.encode("utf-8")).hexdigest() if origin_text else "",
  }


def collect_one(index: int, row: dict, facts: dict, refresh=False):
  kanji = clean(row.get("漢字"))
  kanjipedia = collect_kanjipedia(kanji, refresh=refresh)
  jigen = collect_jigen(kanji, facts.get(kanji, {}), refresh=refresh)
  kanjipedia_types = set(kanjipedia.get("formationTypes", []))
  jigen_types = set(jigen.get("formationTypes", []))
  agreed_types = sorted(kanjipedia_types & jigen_types, key=FORMATION_TYPES.index)
  return index, kanji, {
      "kanjipedia": summarize_source(kanjipedia),
      "jigen": summarize_source(jigen),
      "agreement": {
          "formationTypes": agreed_types,
          "status": "matched" if agreed_types else "unmatched",
      },
  }


def main():
  parser = argparse.ArgumentParser(description="Collect source metadata for the 3000-kanji etymology review.")
  parser.add_argument("--limit", type=int, default=0)
  parser.add_argument("--start", type=int, default=0)
  parser.add_argument("--workers", type=int, default=3)
  parser.add_argument("--refresh", action="store_true")
  args = parser.parse_args()

  master = load_json(MASTER_PATH, [])
  facts = load_json(FACTS_PATH, {}).get("entries", {})
  selected = list(enumerate(master))[args.start:]
  if args.limit > 0:
    selected = selected[:args.limit]

  existing_index = load_json(OUTPUT_PATH, {"schemaVersion": 1, "entries": {}})
  entries = dict(existing_index.get("entries", {}))
  completed = 0
  failures = []

  with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 6))) as executor:
    futures = {
        executor.submit(collect_one, index, row, facts, args.refresh): (index, clean(row.get("漢字")))
        for index, row in selected
    }
    for future in as_completed(futures):
      index, kanji = futures[future]
      try:
        _, _, result = future.result()
        entries[kanji] = result
      except Exception as error:  # Network failures remain visible and resumable.
        failures.append({"index": index, "kanji": kanji, "error": str(error)})
      completed += 1
      if completed % 25 == 0 or completed == len(futures):
        ordered_entries = {
            clean(row.get("漢字")): entries[clean(row.get("漢字"))]
            for row in master
            if clean(row.get("漢字")) in entries
        }
        save_json(OUTPUT_PATH, {
            "schemaVersion": 1,
            "entries": ordered_entries,
            "failures": failures,
        })
        print(f"Collected {completed}/{len(futures)} (total cached: {len(ordered_entries)}, failures: {len(failures)})", flush=True)

  matched = sum(
      1 for entry in entries.values()
      if entry.get("agreement", {}).get("status") == "matched"
  )
  print(json.dumps({
      "selected": len(selected),
      "indexed": len(entries),
      "matched": matched,
      "failures": len(failures),
  }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
  main()
