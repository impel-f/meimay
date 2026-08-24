# Codex Work Rules

- Reply to the user in polite Japanese by default, using desu/masu style unless the user explicitly asks otherwise.
- Keep Android test-track versions on the `1.0.x` line and increment both `versionName` and `versionCode`; align Android with Apple's `1.1.x` line only when moving to production release.
- Edit the existing owner file directly. Do not add late-loading override code to work around a failed edit.
- Do not introduce duplicate top-level function or variable declarations. If behavior changes, replace the existing definition.
- Before changing behavior, find the current implementation with `git grep` or `Select-String`. If `rg` is unavailable, use those fallbacks instead of appending new code.
- After edits, run `git diff --check` and a JavaScript syntax check for touched files when possible.
- Keep cache-busting script versions in `public/index.html` aligned with touched JavaScript files.
- Do not stage or commit promotional/store-listing image assets or local release artifacts unless the user explicitly asks for those exact files. Keep `release/app-store-screenshots/`, `release/google-play-listing/`, `tmp/screenshots/`, and generated `.aab` files out of Git by default.
- Before building Android AABs, run Capacitor sync, then `npm run prune:native-marketing-assets -- android`, and verify the generated AAB contains no `base/assets/public/marketing-assets/` entries.
- Before publishing iOS builds, check the latest App Store Connect/TestFlight build number and make `CFBundleVersion`/`IOS_BUILD_NUMBER` strictly higher than the previously uploaded value; update both `codemagic.yaml` and `ios/App/App.xcodeproj/project.pbxproj` together.
- Do not use Gemini or another paid external AI API for development-time data creation. Create and review data in the user-selected Codex 5.6sol session instead. If the user explicitly approves an exceptional paid API run, first report its item count and minimum request count; the run must use both `MEIMAY_ALLOW_BULK_GEMINI=1` and `--confirm-cost` even for a single item.
