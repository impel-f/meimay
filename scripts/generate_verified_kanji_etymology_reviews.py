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

FORMATION_PATTERN = r"会意形声|形声|会意|象形|指事|仮借"
UNCERTAIN_PATTERN = re.compile(r"一説|異説|諸説|ともいう|ともいわれ|という説|定説")
UNSAFE_PATTERN = re.compile(r"〔画像部品:|�|undefined|[\uE000-\uF8FF]")


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
      or 0x20000 <= ord(char) <= 0x2FA1F
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
      r"^(.{1,28}?)の形にかたど[りる]",
      r"^(.{1,28}?)形にかたど[りる]",
      r"^(.{1,28}?)にかたど[りる]",
  )
  for pattern in patterns:
    match = re.search(pattern, body)
    if not match:
      continue
    subject = clean(match.group(1)).strip("、。 ")
    while re.search(r"[（(][^（）()]*[）)]", subject):
      subject = re.sub(r"[（(][^（）()]*[）)]", "", subject)
    subject = clean(subject)
    if subject and not re.search(r"[。；;]|画像", subject):
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
  match = re.search(r"^(.{1,24}?)と、音符(.{1,16}?)とから成[りる]", body)
  if not match:
    return None
  semantic = strip_annotation(match.group(1))
  phonetic = strip_annotation(match.group(2))
  if not is_safe_component(semantic) or not is_safe_component(phonetic):
    return None
  old_prefix = "の旧字" if origin_text.startswith("旧字は、") else ""
  if formation_type == "会意形声":
    text = f"「{kanji}」{old_prefix}は、「{semantic}」と、音も示す「{phonetic}」を組み合わせた会意形声文字です。"
  else:
    text = f"「{kanji}」{old_prefix}は、意味に関わる「{semantic}」と、音を表す「{phonetic}」を組み合わせた形声文字です。"
  return text, semantic, phonetic


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
  old_prefix = "の旧字" if origin_text.startswith("旧字は、") else ""
  return f"「{kanji}」{old_prefix}は、{labels}の意味を組み合わせた会意文字です。", components


def build_fixed_entry(kanji: str, row: dict, index_entry: dict, source_entry: dict):
  agreement = index_entry.get("agreement", {})
  agreed_types = agreement.get("formationTypes", [])
  origin_text = clean(source_entry.get("originText"))
  if len(agreed_types) != 1 or not origin_text:
    return None, "formation_not_unique"
  if index_entry.get("kanjipedia", {}).get("hasUnresolvedGlyph") or UNSAFE_PATTERN.search(origin_text):
    return None, "unresolved_glyph"
  if UNCERTAIN_PATTERN.search(origin_text):
    return None, "uncertain_theory"

  formation_type = agreed_types[0]
  semantic_component = ""
  phonetic_component = ""
  if formation_type in ("形声", "会意形声"):
    generated = build_phonetic_text(kanji, origin_text, formation_type)
    if not generated:
      return None, "component_parse_failed"
    fixed_text, semantic_component, phonetic_component = generated
  elif formation_type == "会意":
    generated = build_ideographic_text(kanji, origin_text)
    if not generated:
      return None, "component_parse_failed"
    fixed_text, _ = generated
  elif formation_type == "象形":
    subject = extract_shape_subject(origin_text)
    if not subject:
      return None, "shape_parse_failed"
    old_prefix = "の旧字" if origin_text.startswith("旧字は、") else ""
    fixed_text = f"「{kanji}」{old_prefix}は、{build_shape_phrase(subject)}をもとに作られた象形文字です。"
  else:
    return None, "requires_manual_review"

  extra = meaning_summary(row)
  if extra:
    fixed_text += extra
  if len(fixed_text) < 40 or len(fixed_text) > 135:
    return None, "length_out_of_range"

  sources = [
      {
          "name": "字源.net",
          "url": index_entry["jigen"]["url"],
          "kind": "etymology",
      },
      {
          "name": "漢字ペディア",
          "url": index_entry["kanjipedia"]["url"],
          "kind": "cross_check",
      }
  ]
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
  if kanji in standard_text and glyph_kind in ("旧字体", "異体字", "別体"):
    return True
  return glyph_kind == "旧字体" and standard_text.startswith(f"「{standard_kanji}」の旧字")


def inherit_variant_entry(kanji: str, row: dict, standard_kanji: str, standard_entry: dict):
  standard_text = clean(standard_entry.get("fixedOriginText"))
  if not standard_text or not can_inherit_variant(kanji, row, standard_kanji, standard_text):
    return None
  origin_sentence = first_sentence(standard_text)
  prefixes = (
      f"「{standard_kanji}」の旧字「{kanji}」は、",
      f"「{standard_kanji}」の旧字は、",
      f"「{standard_kanji}」は、",
  )
  for prefix in prefixes:
    if origin_sentence.startswith(prefix):
      origin_sentence = f"「{kanji}」は、" + origin_sentence[len(prefix):]
      break
  else:
    return None
  text = origin_sentence + meaning_summary(row)
  if len(text) < 40 or len(text) > 150:
    return None
  inherited = {
      "formationTypes": list(standard_entry.get("formationTypes", [])),
      "fixedOriginText": text,
      "reviewMethod": "variant_inheritance",
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
