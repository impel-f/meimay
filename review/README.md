# Kanji Etymology Review

`kanji-etymology-review.html` is the internal review ledger for all 3,000 kanji.

Regenerate it after changing the etymology facts or overrides:

```powershell
node scripts/generate_kanji_etymology_review_report.js
```

Only entries marked `公開可能` or `公開可能（構造化）` may provide a user-facing origin explanation. Component-only data is for internal glyph search and must never be displayed as etymology.
