import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "public" / "data" / "kanji_data.json"
INDEX_PATH = ROOT / "scripts" / "data" / "kanji_etymology_source_index.json"
MANUAL_PATH = ROOT / "scripts" / "data" / "kanji_etymology_overrides.json"
REVIEW_DIR = ROOT / "scripts" / "data" / "kanji_etymology_reviews"
OUTPUT_PATH = REVIEW_DIR / "auto_verified.json"
CACHE_DIR = ROOT / ".cache" / "meimay-data" / "etymology-sources" / "kanjipedia"
DETAIL_CACHE_DIR = ROOT / ".cache" / "meimay-data" / "etymology-sources" / "kanjitisiki-detail"

FORMATION_PATTERN = r"会意形声|形声|会意|象形|指事|仮借"
UNCERTAIN_PATTERN = re.compile(r"一説|異説|諸説|ともいう|ともいわれ|という説|定説")
UNSAFE_PATTERN = re.compile(r"〔画像部品:|�|undefined|[\uE000-\uF8FF]|[\U00020000-\U0002FA1F]")


def load_json(path: Path, fallback=None):
  if not path.exists():
    return fallback
  return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value):
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(
      json.dumps(value, ensure_ascii=False, indent=2) + "\n",
      encoding="utf-8",
  )


def clean(value):
  return re.sub(r"\s+", " ", str(value or "")).strip()


def cache_path(kanji: str):
  codepoints = "-".join(f"{ord(char):x}" for char in kanji)
  return CACHE_DIR / f"{codepoints}.json"


def detail_cache_path(kanji: str):
  codepoints = "-".join(f"{ord(char):x}" for char in kanji)
  return DETAIL_CACHE_DIR / f"{codepoints}.json"


def formation_types_compatible(primary: str, supporting: str):
  if primary == supporting:
    return True
  return {primary, supporting} <= {"形声", "会意形声"}


def strip_annotation(value: str):
  value = clean(value)
  value = re.split(r"[（(]", value, maxsplit=1)[0]
  value = re.sub(r"→.*$", "", value)
  value = re.sub(r"^(?:意符|義符|声符|音符)", "", value)
  value = value.strip("「」『』（）() \t、。")
  return value


def is_safe_component(value: str):
  if not value or len(value) > 4 or re.search(r"[、。・\s]|画像|変わった|省略", value):
    return False
  return all(
      0x3400 <= ord(char) <= 0x4DBF
      or 0x4E00 <= ord(char) <= 0x9FFF
      or 0xF900 <= ord(char) <= 0xFAFF
      or char == "々"
      for char in value
  )


def meaning_summary(row: dict):
  source = clean(row.get("意味"))
  if not source:
    return ""
  pieces = []
  for part in re.split(r"[。；;]", source):
    part = clean(re.sub(r"[（(].*?[）)]", "", part))
    if not part or len(part) > 20 or part in pieces:
      continue
    pieces.append(part)
    if len(pieces) == 2:
      break
  if not pieces:
    return ""
  quoted = "」「".join(pieces)
  return f"「{quoted}」などの意味に用いられます。"


def extract_shape_subject(origin_text: str):
  body = re.sub(rf"^(?:旧字は、)?(?:{FORMATION_PATTERN})。", "", origin_text)
  patterns = (
      r"(?:^|。)([^。]{1,48}?)の形にかたど[りる]",
      r"(?:^|。)([^。]{1,48}?)形にかたど[りる]",
      r"(?:^|。)([^。]{1,48}?)にかたど[りる]",
  )
  for pattern in patterns:
    match = re.search(pattern, body)
    if not match:
      continue
    subject = clean(match.group(1)).strip("、。 ")
    while re.search(r"[（(][^（）()]*[）)]", subject):
      subject = re.sub(r"[（(][^（）()]*[）)]", "", subject)
    subject = clean(subject)
    subject = re.sub(r"^.*、のち、", "", subject)
    if (
        subject
        and not re.search(r"[。；;（）()]|画像", subject)
        and not re.match(r"^(?:その|それ|これ|のち)", subject)
    ):
      return subject
  return ""


def build_shape_phrase(subject: str):
  if re.search(r"(?:た|だ|る|いる|れる|せる)$", subject):
    return f"{subject}形"
  return f"{subject}の形"


def extract_components(before_and_from: str):
  normalized = clean(before_and_from)
  normalized = re.sub(r"^[、。 ]+", "", normalized)
  parts = re.split(r"と、|とにより|とから", normalized)
  components = []
  for part in parts:
    component = strip_annotation(part)
    if component.endswith("（省略形）"):
      component = component[:-5]
    if not is_safe_component(component):
      return []
    if component not in components:
      components.append(component)
  return components


def build_phonetic_text(kanji: str, origin_text: str, formation_type: str):
  body = re.sub(rf"^(?:旧字は、)?(?:{FORMATION_PATTERN})。", "", origin_text)
  match = re.search(r"^(.{1,40}?)と、音符(.{1,40}?)(?:と)?から成[りる]", body)
  if not match:
    return None
  semantic = strip_annotation(match.group(1))
  phonetic = strip_annotation(match.group(2))
  if not is_safe_component(semantic) or not is_safe_component(phonetic):
    return None
  old_prefix = "のもとになった旧字" if origin_text.startswith("旧字は、") else ""
  if formation_type == "会意形声":
    text = f"「{kanji}」{old_prefix}は、「{semantic}」と、音も示す「{phonetic}」を組み合わせた会意形声文字です。"
  else:
    text = f"「{kanji}」{old_prefix}は、意味に関わる「{semantic}」と、音を表す「{phonetic}」を組み合わせた形声文字です。"
  return text, semantic, phonetic


def build_ideographic_phonetic_text(kanji: str, origin_text: str):
  body = re.sub(rf"^(?:旧字は、)?(?:{FORMATION_PATTERN})。", "", origin_text)
  match = re.search(r"^(.{1,72}?)とから成[りる]", body)
  if not match:
    return None
  components = extract_components(match.group(1))
  if len(components) < 2 or len(components) > 4:
    return None
  labels = "と".join(f"「{component}」" for component in components)
  phonetic = components[-1]
  old_prefix = "のもとになった旧字" if origin_text.startswith("旧字は、") else ""
  text = (
      f"「{kanji}」{old_prefix}は、{labels}の意味を組み合わせ、"
      f"「{phonetic}」が音も示す会意形声文字です。"
  )
  return text, phonetic


def build_ideographic_text(kanji: str, origin_text: str):
  body = re.sub(rf"^(?:旧字は、)?(?:{FORMATION_PATTERN})。", "", origin_text)
  match = re.search(r"^(.{1,60}?)とから成[りる]", body)
  if not match:
    match = re.search(r"^(.{1,60}?)とにより", body)
  if not match:
    return None
  components = extract_components(match.group(1))
  if len(components) < 2 or len(components) > 4:
    return None
  labels = "と".join(f"「{component}」" for component in components)
  old_prefix = "のもとになった旧字" if origin_text.startswith("旧字は、") else ""
  return f"「{kanji}」{old_prefix}は、{labels}の意味を組み合わせた会意文字です。", components


def build_fixed_entry(kanji: str, row: dict, index_entry: dict, source_entry: dict):
  agreement = index_entry.get("agreement", {})
  agreed_types = agreement.get("formationTypes", [])
  origin_text = clean(source_entry.get("originText"))
  if len(agreed_types) != 1 or not origin_text:
    return None, "formation_not_unique"
  if re.match(r"^\([A-Z]\)", origin_text):
    return None, "multiple_origin_entries"
  if index_entry.get("kanjipedia", {}).get("hasUnresolvedGlyph") or UNSAFE_PATTERN.search(origin_text):
    return None, "unresolved_glyph"
  if UNCERTAIN_PATTERN.search(origin_text):
    return None, "uncertain_theory"

  formation_type = agreed_types[0]
  semantic_component = ""
  phonetic_component = ""
  if formation_type == "形声":
    generated = build_phonetic_text(kanji, origin_text, formation_type)
    if not generated:
      return None, "component_parse_failed"
    fixed_text, semantic_component, phonetic_component = generated
  elif formation_type == "会意形声":
    generated = build_phonetic_text(kanji, origin_text, formation_type)
    if generated:
      fixed_text, semantic_component, phonetic_component = generated
    else:
      generated = build_ideographic_phonetic_text(kanji, origin_text)
      if not generated:
        return None, "component_parse_failed"
      fixed_text, phonetic_component = generated
  elif formation_type == "会意":
    generated = build_ideographic_text(kanji, origin_text)
    if not generated:
      return None, "component_parse_failed"
    fixed_text, _ = generated
  elif formation_type == "象形":
    subject = extract_shape_subject(origin_text)
    if not subject:
      return None, "shape_parse_failed"
    old_prefix = "のもとになった旧字" if origin_text.startswith("旧字は、") else ""
    fixed_text = f"「{kanji}」{old_prefix}は、{build_shape_phrase(subject)}をもとに作られた象形文字です。"
  else:
    return None, "requires_manual_review"

  extra = meaning_summary(row)
  if extra:
    fixed_text += extra
  if len(fixed_text) < 40 or len(fixed_text) > 135:
    return None, "length_out_of_range"

  source_labels = {
      "kanjipedia": "漢字ペディア",
      "jigen": "字源.net",
      "kanjitisiki": "漢字辞典オンライン",
      "kanjitisikiDetail": "漢字辞典",
  }
  supporting_sources = agreement.get("sourcesByType", {}).get(formation_type, [])
  sources = [
      {
          "name": source_labels[source["name"]],
          "url": source["url"],
          "kind": "etymology" if source["name"] == "kanjipedia" else "cross_check",
      }
      for source in supporting_sources
      if source.get("name") in source_labels and source.get("url")
  ]
  source_domains = {
      re.sub(r"^www\.", "", re.sub(r"^https?://", "", source["url"]).split("/", 1)[0])
      for source in sources
  }
  if len(source_domains) < 2:
    return None, "cross_check_missing"
  entry = {
      "formationTypes": [formation_type],
      "fixedOriginText": fixed_text,
      "reviewMethod": "source_template",
      "sources": sources,
  }
  if semantic_component:
    entry["semanticComponent"] = semantic_component
  if phonetic_component:
    entry["phoneticComponent"] = phonetic_component
  return entry, "generated"


def build_detail_fixed_entry(kanji: str, row: dict, index_entry: dict, detail_entry: dict):
  origin_text = clean(detail_entry.get("originText"))
  detail_types = list(detail_entry.get("formationTypes", []))
  if clean(detail_entry.get("pageKanji")) != kanji:
    return None, "detail_page_identity_unverified"
  if detail_entry.get("status") != "ok" or not origin_text or UNSAFE_PATTERN.search(origin_text):
    return None, "detail_source_missing"
  if UNCERTAIN_PATTERN.search(origin_text):
    return None, "detail_uncertain_theory"

  primary_sources = []
  for source_name in ("kanjipedia", "jigen"):
    source = index_entry.get(source_name, {})
    source_types = list(source.get("formationTypes", []))
    matched_type = next((
        primary_type
        for primary_type in source_types
        if any(formation_types_compatible(primary_type, detail_type) for detail_type in detail_types)
    ), "")
    if source.get("status") == "ok" and source_types and not matched_type:
      return None, "detail_primary_source_conflict"
    if matched_type and source.get("url"):
      primary_sources.append({
          "name": "漢字ペディア" if source_name == "kanjipedia" else "字源.net",
          "url": source["url"],
          "kind": "etymology",
          "formationType": matched_type,
      })
  compatible_types = sorted({source["formationType"] for source in primary_sources})
  if len(compatible_types) != 1:
    return None, "detail_classification_not_unique"
  formation_type = compatible_types[0]

  body = re.sub(rf"^(?:※\s*)?【\s*(?:{FORMATION_PATTERN})\s*】\s*", "", origin_text)
  semantic_component = ""
  phonetic_component = ""
  if formation_type in ("形声", "会意形声"):
    match = re.search(r"意\s*「([^」]+)」\s*[＋+]\s*音\s*「([^」]+)」", body)
    if not match:
      return None, "detail_component_parse_failed"
    semantic_component = strip_annotation(match.group(1))
    phonetic_component = strip_annotation(match.group(2))
    if not is_safe_component(semantic_component) or not is_safe_component(phonetic_component):
      return None, "detail_unsafe_component"
    if formation_type == "会意形声":
      fixed_text = (
          f"「{kanji}」は、意味に関わる「{semantic_component}」と、"
          f"音も示す「{phonetic_component}」を組み合わせた会意形声文字です。"
      )
    else:
      fixed_text = (
          f"「{kanji}」は、意味に関わる「{semantic_component}」と、"
          f"音を表す「{phonetic_component}」を組み合わせた形声文字です。"
      )
  elif formation_type == "会意":
    first_sentence = body.split("。", 1)[0]
    components = [
        strip_annotation(value)
        for value in re.findall(r"「([^」]+)」", first_sentence)
    ]
    if len(components) < 2 or len(components) > 4 or not all(is_safe_component(value) for value in components):
      return None, "detail_component_parse_failed"
    labels = "と".join(f"「{component}」" for component in components)
    fixed_text = f"「{kanji}」は、{labels}の意味を組み合わせた会意文字です。"
  elif formation_type == "象形":
    first_sentence = body.split("。", 1)[0]
    subject_match = re.search(r"^(.+?)をかたどり", first_sentence)
    if not subject_match:
      return None, "detail_shape_parse_failed"
    subject = clean(subject_match.group(1)).strip("、。 ")
    if not subject or re.search(r"[「」【】]|画像", subject):
      return None, "detail_shape_parse_failed"
    fixed_text = f"「{kanji}」は、{subject}をかたどった象形文字です。"
  elif formation_type == "指事":
    first_sentence = body.split("。", 1)[0]
    first_sentence = re.sub(r"短い横線で（([^）]+)）、", r"短い横線を加え（\1）、", first_sentence)
    statement = re.sub(r"の意を表します$", "の意味を表した", first_sentence)
    if statement == first_sentence or re.search(r"画像|〔", statement):
      return None, "detail_indicative_parse_failed"
    fixed_text = f"「{kanji}」は、{statement}指事文字です。"
  else:
    return None, "detail_requires_manual_review"

  extra = meaning_summary(row)
  if extra:
    fixed_text += extra
  if len(fixed_text) < 40 or len(fixed_text) > 135:
    return None, "detail_length_out_of_range"

  sources = [
      {"name": source["name"], "url": source["url"], "kind": source["kind"]}
      for source in primary_sources
  ]
  sources.append({
      "name": "漢字辞典",
      "url": detail_entry["url"],
      "kind": "cross_check",
  })
  entry = {
      "formationTypes": [formation_type],
      "fixedOriginText": fixed_text,
      "reviewMethod": "source_template",
      "sources": sources,
  }
  if semantic_component:
    entry["semanticComponent"] = semantic_component
  if phonetic_component:
    entry["phoneticComponent"] = phonetic_component
  return entry, "detail_generated"


def load_manual_entries():
  manual = dict(load_json(MANUAL_PATH, {}))
  for path in sorted(REVIEW_DIR.glob("*.json")):
    if path == OUTPUT_PATH:
      continue
    manual.update(load_json(path, {}))
  return manual


def first_sentence(text: str):
  text = clean(text)
  index = text.find("。")
  return text if index < 0 else text[:index + 1]


def can_inherit_variant(kanji: str, row: dict, standard_kanji: str, standard_text: str):
  if unicodedata.normalize("NFKC", kanji) == standard_kanji:
    return True
  glyph_kind = clean(row.get("字形種別"))
  if glyph_kind in ("旧字体", "異体字", "別体"):
    return True
  return False


def inherit_variant_entry(kanji: str, row: dict, standard_kanji: str, standard_entry: dict):
  standard_text = clean(standard_entry.get("fixedOriginText"))
  if not standard_text or not can_inherit_variant(kanji, row, standard_kanji, standard_text):
    return None
  origin_sentence = first_sentence(standard_text)
  prefixes = (
      f"「{standard_kanji}」の旧字「{kanji}」は、",
      f"「{standard_kanji}」のもとになった旧字は、",
      f"「{standard_kanji}」の旧字は、",
      f"「{standard_kanji}」の本字は、",
      f"「{standard_kanji}」は、",
  )
  for prefix in prefixes:
    if origin_sentence.startswith(prefix):
      if prefix == f"「{standard_kanji}」は、" and kanji != standard_kanji:
        glyph_kind = clean(row.get("字形種別")) or "異体字"
        origin_sentence = (
            f"「{kanji}」は、「{standard_kanji}」の{glyph_kind}で、成り立ちは共通です。"
            + origin_sentence
        )
      else:
        origin_sentence = f"「{kanji}」は、" + origin_sentence[len(prefix):]
      break
  else:
    return None
  text = origin_sentence + meaning_summary(row)
  if len(text) > 180:
    text = origin_sentence
  if len(text) < 40 or len(text) > 180:
    return None
  inherited = {
      "formationTypes": list(standard_entry.get("formationTypes", [])),
      "fixedOriginText": text,
      "reviewMethod": (
          "source_grounded_variant_inheritance"
          if standard_entry.get("reviewMethod") in (
              "source_grounded_ai_review",
              "source_grounded_variant_inheritance",
              "manual_source_review",
          )
          else "variant_inheritance"
      ),
      "originSourceKanji": standard_kanji,
      "sources": list(standard_entry.get("sources", [])),
  }
  for key in ("semanticComponent", "phoneticComponent"):
    if standard_entry.get(key):
      inherited[key] = standard_entry[key]
  return inherited


def main():
  master = load_json(MASTER_PATH, [])
  index = load_json(INDEX_PATH, {}).get("entries", {})
  manual_entries = load_manual_entries()
  manual_kanji = set(manual_entries)
  generated = {}
  reasons = {}

  for row in master:
    kanji = clean(row.get("漢字"))
    if not kanji or kanji in manual_kanji:
      continue
    index_entry = index.get(kanji)
    source_entry = load_json(cache_path(kanji), {})
    if not index_entry or not source_entry:
      reasons["source_missing"] = reasons.get("source_missing", 0) + 1
      continue
    entry, reason = build_fixed_entry(kanji, row, index_entry, source_entry)
    if not entry:
      detail_entry = load_json(detail_cache_path(kanji), {})
      detail_review, detail_reason = build_detail_fixed_entry(kanji, row, index_entry, detail_entry)
      if detail_review:
        entry, reason = detail_review, detail_reason
      else:
        reason = detail_reason
    reasons[reason] = reasons.get(reason, 0) + 1
    if entry:
      generated[kanji] = entry

  known_entries = {**manual_entries, **generated}
  inherited_count = 0
  changed = True
  while changed:
    changed = False
    for row in master:
      kanji = clean(row.get("漢字"))
      standard_kanji = clean(row.get("標準字体"))
      if not kanji or kanji in known_entries or not standard_kanji:
        continue
      inherited = inherit_variant_entry(kanji, row, standard_kanji, known_entries.get(standard_kanji, {}))
      if not inherited:
        continue
      generated[kanji] = inherited
      known_entries[kanji] = inherited
      inherited_count += 1
      changed = True

  save_json(OUTPUT_PATH, generated)
  print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
  print(json.dumps({
      "generated": len(generated),
      "sourceTemplate": len(generated) - inherited_count,
      "variantInheritance": inherited_count,
      "skippedManual": len(manual_kanji),
      "reasons": dict(sorted(reasons.items())),
  }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
  main()
