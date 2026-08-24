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
KANJITISIKI_CACHE = CACHE_ROOT / "kanjitisiki-formations.json"
KANJITISIKI_DETAIL_CACHE = CACHE_ROOT / "kanjitisiki-detail"

KANJIPEDIA_SEARCH_URL = "https://www.kanjipedia.jp/search"
KANJIPEDIA_BASE_URL = "https://www.kanjipedia.jp"
JIGEN_SEARCH_URL = "https://jigen.net/data/{quoted}?type2=1"
JIGEN_BASE_URL = "https://jigen.net"
KANJITISIKI_SEARCH_URL = "https://kanjitisiki.com/search/search.php"
KANJITISIKI_FORMATION_URLS = {
    "象形": "https://kanjitisiki.com/info/006-01.html",
    "指事": "https://kanjitisiki.com/info/006-02.html",
    "会意": "https://kanjitisiki.com/info/006-03.html",
    "形声": "https://kanjitisiki.com/info/006-04.html",
}
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


def fetch_text_with_url(url: str, *, params=None, attempts=4):
  last_error = None
  for attempt in range(attempts):
    try:
      time.sleep(0.12)
      response = get_session().get(url, params=params, timeout=25)
      response.raise_for_status()
      if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
      return response.text, response.url
    except requests.RequestException as error:
      last_error = error
      if attempt + 1 < attempts:
        time.sleep(0.8 * (attempt + 1))
  raise last_error


def fetch_text(url: str, *, params=None, attempts=4):
  return fetch_text_with_url(url, params=params, attempts=attempts)[0]


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


def formation_types_compatible(primary: str, supporting: str):
  if primary == supporting:
    return True
  return {primary, supporting} <= {"形声", "会意形声"}


def collect_kanjitisiki_formations(refresh=False):
  if KANJITISIKI_CACHE.exists() and not refresh:
    cached = load_json(KANJITISIKI_CACHE, {})
    if cached and all("detailUrlsByType" in entry for entry in cached.values()):
      return cached

  entries = {}
  for formation_type, page_url in KANJITISIKI_FORMATION_URLS.items():
    page_html = fetch_text(page_url)
    page_soup = BeautifulSoup(page_html, "html.parser")
    for anchor in page_soup.select("ul.itiran_kakoi a[href]"):
      kanji = clean(anchor.get_text(" ", strip=True))
      if len(kanji) != 1:
        continue
      entry = entries.setdefault(kanji, {
          "formationTypes": [],
          "urlsByType": {},
          "detailUrlsByType": {},
      })
      if formation_type not in entry["formationTypes"]:
        entry["formationTypes"].append(formation_type)
      entry["urlsByType"][formation_type] = page_url
      entry["detailUrlsByType"][formation_type] = urljoin(page_url, anchor.get("href"))

  save_json(KANJITISIKI_CACHE, entries)
  return entries


def collect_kanjitisiki_detail(kanji: str, formation_entry: dict, primary_types: list, refresh=False, offline=False):
  destination = cache_path(KANJITISIKI_DETAIL_CACHE, kanji)
  if destination.exists() and not refresh:
    cached = load_json(destination, {})
    if offline or cached.get("status") not in ("not_found", "missing_origin") or cached.get("searchAttempted"):
      return cached
  if offline:
    return {
        "kanji": kanji,
        "url": "",
        "formationTypes": [],
        "originText": "",
        "unresolvedGlyphs": [],
        "status": "not_collected",
        "searchAttempted": False,
    }

  detail_urls = formation_entry.get("detailUrlsByType", {})
  matched_type = next((
      formation_type
      for primary_type in primary_types
      for formation_type in formation_entry.get("formationTypes", [])
      if formation_types_compatible(primary_type, formation_type)
      and detail_urls.get(formation_type)
  ), "")
  page_url = clean(detail_urls.get(matched_type))
  search_attempted = False
  page_html = ""
  if not page_url:
    search_attempted = True
    time.sleep(1.0)
    search_html, resolved_url = fetch_text_with_url(
        KANJITISIKI_SEARCH_URL,
        params={"kensaku": kanji, "how": "kanji"},
    )
    if "kanjitisiki.com/" in resolved_url and "/search/" not in resolved_url:
      page_url = resolved_url
      page_html = search_html
  result = {
      "kanji": kanji,
      "url": page_url,
      "formationTypes": [matched_type] if matched_type else [],
      "originText": "",
      "unresolvedGlyphs": [],
      "status": "not_found" if not page_url else "missing_origin",
      "searchAttempted": search_attempted,
  }
  if page_url:
    page_html = page_html or fetch_text(page_url)
    page_soup = BeautifulSoup(page_html, "html.parser")
    heading = next((
        node for node in page_soup.find_all(("h2", "h3"))
        if clean(node.get_text(" ", strip=True)) == "成り立ち"
    ), None)
    origin_node = heading.find_next_sibling("p") if heading else None
    if origin_node:
      origin_text, unresolved = extract_text_with_image_markers(origin_node)
      result.update({
          "originText": origin_text,
          "formationTypes": extract_formation_types(origin_text) or result["formationTypes"],
          "unresolvedGlyphs": unresolved,
          "status": "ok" if origin_text and not unresolved else "unresolved_glyph",
      })

  save_json(destination, result)
  return result


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


def summarize_formation_source(source: dict):
  formation_types = list(source.get("formationTypes", []))
  source_value = "|".join(formation_types)
  return {
      "url": clean(source.get("url")),
      "urlsByType": dict(source.get("urlsByType", {})),
      "detailUrlsByType": dict(source.get("detailUrlsByType", {})),
      "formationTypes": formation_types,
      "status": clean(source.get("status")),
      "hasUnresolvedGlyph": False,
      "sourceHash": hashlib.sha256(source_value.encode("utf-8")).hexdigest() if source_value else "",
  }


def collect_one(index: int, row: dict, facts: dict, kanjitisiki_formations: dict, refresh=False, offline=False):
  kanji = clean(row.get("漢字"))
  kanjipedia = collect_kanjipedia(kanji, refresh=refresh)
  existing_fact = facts.get(kanji, {})
  jigen = collect_jigen(kanji, existing_fact, refresh=refresh)
  kanjitisiki = dict(kanjitisiki_formations.get(kanji, {}))
  kanjitisiki.update({
      "url": "",
      "status": "ok" if kanjitisiki.get("formationTypes") else "not_found",
  })
  kanjitisiki_detail = collect_kanjitisiki_detail(
      kanji,
      kanjitisiki,
      kanjipedia.get("formationTypes", []),
      refresh=refresh,
      offline=offline,
  )
  source_values = {
      "kanjipedia": kanjipedia,
      "jigen": jigen,
      "kanjitisiki": kanjitisiki,
      "kanjitisikiDetail": kanjitisiki_detail,
  }
  primary_types = next((
      source.get("formationTypes", [])
      for source in source_values.values()
      if source.get("formationTypes")
  ), [])
  agreed_types = []
  sources_by_type = {}
  for primary_type in primary_types:
    supporting_sources = []
    for source_name, source in source_values.items():
      matched_type = next((
          formation_type
          for formation_type in source.get("formationTypes", [])
          if formation_types_compatible(primary_type, formation_type)
      ), "")
      if not matched_type:
        continue
      url = clean(source.get("url"))
      if source_name == "kanjitisiki":
        url = clean(source.get("urlsByType", {}).get(matched_type))
      if url:
        supporting_sources.append({
            "name": source_name,
            "formationType": matched_type,
            "url": url,
        })
    if len(supporting_sources) >= 2:
      agreed_types.append(primary_type)
      sources_by_type[primary_type] = supporting_sources

  agreed_types = sorted(set(agreed_types), key=FORMATION_TYPES.index)
  return index, kanji, {
      "kanjipedia": summarize_source(kanjipedia),
      "jigen": summarize_source(jigen),
      "kanjitisiki": summarize_formation_source(kanjitisiki),
      "kanjitisikiDetail": summarize_source(kanjitisiki_detail),
      "agreement": {
          "formationTypes": agreed_types,
          "status": "matched" if agreed_types else "unmatched",
          "sourcesByType": sources_by_type,
      },
  }


def main():
  parser = argparse.ArgumentParser(description="Collect source metadata for the 3000-kanji etymology review.")
  parser.add_argument("--limit", type=int, default=0)
  parser.add_argument("--start", type=int, default=0)
  parser.add_argument("--workers", type=int, default=3)
  parser.add_argument("--refresh", action="store_true")
  parser.add_argument("--retry-failures", action="store_true")
  parser.add_argument("--offline", action="store_true", help="Rebuild the index from cached sources only.")
  args = parser.parse_args()

  master = load_json(MASTER_PATH, [])
  facts = load_json(FACTS_PATH, {}).get("entries", {})
  kanjitisiki_formations = collect_kanjitisiki_formations(refresh=args.refresh)
  existing_index = load_json(OUTPUT_PATH, {"schemaVersion": 3, "entries": {}, "failures": []})
  selected = list(enumerate(master))[args.start:]
  if args.retry_failures:
    failed_kanji = {
        clean(item.get("kanji"))
        for item in existing_index.get("failures", [])
        if clean(item.get("kanji"))
    }
    selected = [item for item in selected if clean(item[1].get("漢字")) in failed_kanji]
  if args.limit > 0:
    selected = selected[:args.limit]

  entries = dict(existing_index.get("entries", {}))
  completed = 0
  failures = []

  with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 6))) as executor:
    futures = {
        executor.submit(
            collect_one,
            index,
            row,
            facts,
            kanjitisiki_formations,
            args.refresh,
            args.offline,
        ): (index, clean(row.get("漢字")))
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
            "schemaVersion": 3,
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
