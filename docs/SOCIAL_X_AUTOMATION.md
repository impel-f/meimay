# メイメー X投稿自動化

## 方針

対象は、出産を控えたプレパパ・プレママです。投稿は、丁寧で親しみやすく、運営者個人の自我を出さない文体に寄せます。

主な投稿カテゴリは次の通りです。

- 名づけの小さなヒント
- 漢字や響きの考え方
- パートナーと名前を考えるコツ
- メイメーの機能紹介
- スクリーンショット付きの控えめなアプリ紹介

過度な売り込み、同じ文面の繰り返し、過度なハッシュタグ、トレンド便乗、自動いいね、自動フォローは行いません。

## 最初にやること

1. X Developer Portalで、`@meimay_app` が投稿できるDeveloper Appを用意します。
2. User Access Tokenに投稿権限を付けます。
3. リポジトリ直下の `.env` に次を追加します。

```text
X_USER_ACCESS_TOKEN=ここにUser Access Token
X_API_BASE_URL=https://api.x.com
```

トークンはチャットに貼らず、ローカルの `.env` にだけ入れてください。`.env` は `.gitignore` 済みです。

## 使い方

投稿キューは `data/social/x-post-queue.json` で管理します。`status` が `approved` で、`scheduledAt` を過ぎているものだけが投稿対象です。

検証:

```powershell
npm run social:x:validate
```

投稿予定の確認:

```powershell
npm run social:x:dry-run
```

期限を過ぎた投稿を1件だけ投稿:

```powershell
npm run social:x:post-due
```

期限を過ぎた投稿をすべて投稿:

```powershell
node scripts/social/x-post-due.js --all
```

投稿が成功すると、対象の投稿に `postedAt` と `postId` が追記され、二重投稿を避けます。

## 画像について

投稿キューの `media.path` に画像パスを入れると、X API v2のメディアアップロード後に画像付きで投稿します。

既存の候補画像:

- `release/social/meimay-x-card-1200x675.png`
- `release/app-store-screenshots/2026-05-04-marketing-v5-stock/iphone-6.9-1290x2796/02-reading-swipe.png`
- `release/app-store-screenshots/2026-05-04-marketing-v5-stock/iphone-6.9-1290x2796/04-kanji-stock.png`
- `release/app-store-screenshots/2026-05-04-marketing-v5-stock/iphone-6.9-1290x2796/06-build-reading.png`

画像付き投稿は毎回ではなく、週1回程度を目安にします。

## Codex側の定期実行

`.env` の準備ができたら、Codexの定期実行で `npm run social:x:post-due` を定期的に走らせます。投稿時刻はキュー側で管理するため、定期実行自体は1時間に1回程度で十分です。

初期キューは2026年5月10日から2026年5月27日までの投稿案を入れています。次の運用では、1週間ごとに投稿結果を見て、次の2週間分を追加するのが安全です。
