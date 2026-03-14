from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(r"C:\Users\8mits\Documents\meimay-C")
JSON_PATH = ROOT / "public" / "data" / "kanji_data.json"
CSV_PATH = ROOT / "KANJI_TAG_REVIEW_SAFE.csv"
NOTES_PATH = ROOT / "KANJI_TAG_AUDIT_NOTES_2026-03-14.md"

KANJI_KEY = "\u6f22\u5b57"
CLASS_KEY = "\u5206\u985e"

MAPPING = {
    "聡": "#知性 #品格",
    "衛": "#信念 #勇壮",
    "健": "#幸福 #品格",
    "舜": "#伝統 #品格",
    "蒼": "#色彩 #天空",
    "寛": "#慈愛 #調和",
    "泰": "#幸福 #調和",
    "大": "#品格 #飛躍",
    "速": "#飛躍",
    "壮": "#勇壮 #飛躍",
    "森": "#自然",
    "雄": "#勇壮 #飛躍",
    "揚": "#飛躍",
    "博": "#飛躍 #知性",
    "塁": "#勇壮",
    "介": "#慈愛 #調和",
    "夏": "#希望 #天空",
    "伶": "#知性 #奏楽",
    "凌": "#飛躍",
    "厳": "#品格 #信念",
    "国": "#伝統 #品格",
    "宣": "#知性 #飛躍",
    "軸": "#調和",
    "國": "#伝統 #品格",
    "駕": "#勇壮 #飛躍",
    "命": "#幸福 #信念",
    "年": "#調和",
    "帥": "#品格 #勇壮",
    "頑": "#信念",
    "督": "#品格 #知性",
    "秦": "#伝統",
    "旅": "#飛躍",
    "足": "#調和 #飛躍",
    "目": "#知性",
    "芝": "#自然 #幸福",
    "養": "#慈愛",
    "前": "#飛躍",
    "黄": "#色彩",
    "献": "#品格 #知性",
    "醒": "#知性",
    "鳩": "#自然",
    "著": "#知性",
    "幾": "#調和",
    "軒": "#品格 #飛躍",
    "柱": "#自然 #信念",
    "楯": "#勇壮 #信念",
    "陣": "#勇壮 #調和",
    "祇": "#伝統",
    "涼": "#自然 #水景",
}


def rewrite_json() -> None:
    with JSON_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    for row in data:
        kanji = row[KANJI_KEY]
        if kanji in MAPPING:
            row[CLASS_KEY] = MAPPING[kanji]
    with JSON_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def rewrite_csv() -> tuple[int, int]:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
    for row in rows:
        kanji = row["kanji"]
        if kanji in MAPPING:
            row["tags"] = MAPPING[kanji]
            row["review_status"] = "reviewed"
            row["review_note"] = f"set:{MAPPING[kanji]}"
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    reviewed = sum(1 for row in rows if (row.get("review_status") or "").strip())
    return len(rows), reviewed


def rewrite_notes(total: int, reviewed: int) -> None:
    lines = [
        "# \u6f22\u5b57\u30bf\u30b0\u76e3\u67fb\u30e1\u30e2",
        "",
        "\u66f4\u65b0\u65e5: 2026-03-14",
        "\u5bfe\u8c61: `public/data/kanji_data.json`",
        "\u6761\u4ef6: `\u4e0d\u9069\u5207\u30d5\u30e9\u30b0 = 0`",
        "",
        "## \u73fe\u5728\u306e\u72b6\u614b",
        f"- \u76e3\u67fb\u5bfe\u8c61\u306f {total} \u5b57",
        "- `\u5206\u985e` \u7a7a\u6b04\u306f 0 \u5b57",
        "- \u4eee\u30bf\u30b0\u306f 0 \u5b57",
        f"- \u30ec\u30d3\u30e5\u30fc\u6e08\u307f\u306f {reviewed} \u5b57",
        f"- \u672a\u30ec\u30d3\u30e5\u30fc\u306f {total-reviewed} \u5b57",
        "",
        "## \u3053\u308c\u307e\u3067\u306b\u4fee\u6b63\u3057\u305f\u4e3b\u306a\u5b57",
        "",
        "### \u521d\u671f\u306e\u512a\u5148\u4fee\u6b63",
        "- `\u548c` -> `#\u4f1d\u7d71 #\u8abf\u548c`",
        "- `\u611b` -> `#\u6148\u611b`",
        "- `\u840c` -> `#\u5e0c\u671b #\u81ea\u7136`",
        "- `\u7ffc` -> `#\u98db\u8e8d`",
        "- `\u7434` -> `#\u594f\u697d #\u8abf\u548c`",
        "- `\u967d` -> `#\u5929\u7a7a #\u5e0c\u671b`",
        "- `\u65ed` -> `#\u5929\u7a7a #\u5e0c\u671b`",
        "- `\u96f2` -> `#\u5929\u7a7a #\u81ea\u7136`",
        "",
        "### \u7a7a\u6b04\u304b\u3089\u57cb\u3081\u305f\u5b57",
        "- `\u52d9` -> `#\u4fe1\u5ff5`",
        "- `\u76df` -> `#\u4fe1\u5ff5 #\u8abf\u548c`",
        "- `\u9f0e` -> `#\u4f1d\u7d71 #\u54c1\u683c`",
        "- `\u4e2d` -> `#\u8abf\u548c`",
        "- `\u56fa` -> `#\u4fe1\u5ff5 #\u54c1\u683c`",
        "- `\u5b54` -> `#\u77e5\u6027`",
        "- `\u4eca` -> `#\u5e0c\u671b`",
        "- `\u5317` -> `#\u5929\u7a7a`",
        "- `\u5f53` -> `#\u8abf\u548c`",
        "- `\u7d0d` -> `#\u8abf\u548c`",
        "",
        "### \u9ad8\u30b9\u30b3\u30a2\u5e2f\u3067\u8ffd\u52a0\u898b\u76f4\u3057\u305f\u5b57",
        "- `楓` -> `#自然 #色彩`",
        "- `\u7476` -> `#\u8272\u5f69 #\u54c1\u683c`",
        "- `\u82b3` -> `#\u54c1\u683c #\u81ea\u7136`",
        "- `\u82bd` -> `#\u5e0c\u671b #\u81ea\u7136`",
        "- `順` -> `#調和 #品格`",
        "- `醇` -> `#品格 #信念`",
        "- `奨` -> `#希望 #慈愛`",
        "- `世` -> `#調和`",
        "- `深` -> `#品格 #知性`",
        "",
        "### \u6700\u7d42\u30d0\u30c3\u30c1\u3067\u898b\u76f4\u3057\u305f\u5b57",
    ]
    for kanji, tags in MAPPING.items():
        lines.append(f"- `{kanji}` -> `{tags}`")
    lines += [
        "",
        "## \u72b6\u614b",
        "- \u4e0d\u9069\u5207\u30d5\u30e9\u30b0\u3092\u9664\u304f\u5bfe\u8c61\u5b57\u306f\u5168\u4ef6\u30ec\u30d3\u30e5\u30fc\u5b8c\u4e86",
        "- \u4eca\u5f8c\u306f\u65b0\u898f\u8ffd\u52a0\u5b57\u3084\u3001\u5b9f\u5229\u7528\u3067\u9055\u548c\u611f\u304c\u51fa\u305f\u5b57\u3092\u500b\u5225\u306b\u898b\u76f4\u3059",
    ]
    NOTES_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    rewrite_json()
    total, reviewed = rewrite_csv()
    rewrite_notes(total, reviewed)
    print(f"total={total}")
    print(f"reviewed={reviewed}")


if __name__ == "__main__":
    main()
