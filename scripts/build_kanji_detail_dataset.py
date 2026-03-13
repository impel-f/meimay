import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
DATASET_PATH = DATA_DIR / "kanji_detail_dataset.json"
MASTER_PATH = DATA_DIR / "kanji_data.json"
IDIOMS_PATH = DATA_DIR / "idioms.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean(value):
    return str(value or "").strip()


def split_meaning_parts(raw: str):
    text = clean(raw).replace("。", "、").replace("．", "、")
    parts = []
    seen = set()
    for part in re.split(r"[、,，/／\s]+", text):
        part = clean(part)
        if not part or part in seen:
            continue
        seen.add(part)
        parts.append(part)
    return parts


def build_generated_meaning(raw_meaning: str):
    parts = split_meaning_parts(raw_meaning)
    if not parts:
        return None

    selected = []
    for part in parts:
        selected.append(part)
        joined = "、".join(selected)
        candidate = f"アプリ内辞書では「{joined}」を表す字です。名前に使うときも、その意味を素直な願いとして重ねやすい漢字です。"
        if len(candidate) >= 50:
            break

    text = f"アプリ内辞書では「{'、'.join(selected)}」を表す字です。名前に使うときも、その意味を素直な願いとして重ねやすい漢字です。"

    while len(text) > 80 and len(selected) > 1:
        selected.pop()
        text = f"アプリ内辞書では「{'、'.join(selected)}」を表す字です。名前に使うときも、その意味を素直な願いとして重ねやすい漢字です。"

    if len(text) > 80:
        clipped = selected[0]
        while len(f"アプリ内辞書では「{clipped}」を表す字です。名前に使うときも、その意味を素直な願いとして重ねやすい漢字です。") > 80 and len(clipped) > 1:
            clipped = clipped[:-1]
        text = f"アプリ内辞書では「{clipped}」を表す字です。名前に使うときも、その意味を素直な願いとして重ねやすい漢字です。"

    if len(text) < 50:
        text += "字義が受け取りやすい一字です。"

    return text


def is_four_character_word(word: str):
    return len(list(word)) == 4


def build_idiom_lookup(idioms):
    lookup = {}
    for item in idioms:
        word = clean(item.get("漢字"))
        reading = clean(item.get("読み"))
        meaning = clean(item.get("意味")) or "意味あり"
        if not word or is_four_character_word(word):
            continue
        for char in word:
            lookup.setdefault(char, [])
            formatted = f"{word}（{reading}）：{meaning}" if reading else f"{word}：{meaning}"
            lookup[char].append((word, formatted))
    return lookup


def normalize_manual_idiom_lines(text: str, kanji: str, blocked_words):
    lines = []
    seen = set()
    for line in str(text or "").splitlines():
        line = clean(line)
        if not line:
            continue
        word = clean(re.split(r"[（(:：]", line)[0])
        if not word or is_four_character_word(word) or word in blocked_words or word in seen:
            continue
        seen.add(word)
        if kanji in word:
            lines.append(line)
    return lines


def main():
    current = load_json(DATASET_PATH) if DATASET_PATH.exists() else {}
    master = load_json(MASTER_PATH)
    idioms = load_json(IDIOMS_PATH)
    idiom_lookup = build_idiom_lookup(idioms)

    generated = {}

    for row in master:
        kanji = clean(row.get("漢字"))
        if not kanji:
            continue

        existing = current.get(kanji, {}) if isinstance(current, dict) else {}
        existing_sections = existing.get("sections", []) if isinstance(existing, dict) else []
        existing_reason_map = existing.get("readingReasons", {}) if isinstance(existing, dict) else {}

        sections = []
        blocked_words = set()

        for section in existing_sections:
            title = clean(section.get("title"))
            text = clean(section.get("text"))
            if not title or not text:
                continue

            if title == "代表的な熟語":
                lines = normalize_manual_idiom_lines(text, kanji, blocked_words)
                if lines:
                    for line in lines:
                        blocked_words.add(clean(re.split(r"[（(:：]", line)[0]))
                    sections.append({
                        "title": "代表的な熟語",
                        "text": "\n".join(lines)
                    })
                continue

            sections.append({
                "title": title,
                "text": text
            })

        if not any(section["title"] == "意味の深掘り" for section in sections):
            meaning_text = build_generated_meaning(row.get("意味", ""))
            if meaning_text:
                sections.append({
                    "title": "意味の深掘り",
                    "text": meaning_text
                })

        if not any(section["title"] == "代表的な熟語" for section in sections):
            idiom_lines = []
            seen_words = set()
            for word, formatted in idiom_lookup.get(kanji, []):
                if word in blocked_words or word in seen_words:
                    continue
                seen_words.add(word)
                idiom_lines.append(formatted)
                if len(idiom_lines) >= 3:
                    break
            if idiom_lines:
                sections.append({
                    "title": "代表的な熟語",
                    "text": "\n".join(idiom_lines)
                })

        order = {"成り立ち": 0, "意味の深掘り": 1, "代表的な熟語": 2}
        sections.sort(key=lambda item: order.get(item["title"], 99))

        generated[kanji] = {"sections": sections}
        if isinstance(existing_reason_map, dict) and existing_reason_map:
            generated[kanji]["readingReasons"] = existing_reason_map

    save_json(DATASET_PATH, generated)
    print(f"Generated dataset entries: {len(generated)}")


if __name__ == "__main__":
    main()
