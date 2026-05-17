# Codex Work Rules

- Reply to the user in polite Japanese by default, using desu/masu style unless the user explicitly asks otherwise.
- Keep Android test-track versions on the `1.0.x` line and increment both `versionName` and `versionCode`; align Android with Apple's `1.1.x` line only when moving to production release.
- Edit the existing owner file directly. Do not add late-loading override code to work around a failed edit.
- Do not introduce duplicate top-level function or variable declarations. If behavior changes, replace the existing definition.
- Before changing behavior, find the current implementation with `git grep` or `Select-String`. If `rg` is unavailable, use those fallbacks instead of appending new code.
- After edits, run `git diff --check` and a JavaScript syntax check for touched files when possible.
- Keep cache-busting script versions in `public/index.html` aligned with touched JavaScript files.
