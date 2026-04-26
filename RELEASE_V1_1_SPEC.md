# Meimay v1.1 Release Spec

Updated: 2026-04-26

Goal: 課金、初回体験、法務、ストア提出素材までそろえた状態で v1.1 としてリリースする。

## 1. v1.1 の前提

- iOS / Android のストア配布を前提にする。
- Web/PWA の現資産を活かし、ネイティブ化は Capacitor を第一候補にする。
- デジタル機能の解放は実課金にする。
- ダミー課金、localStorage だけの有料判定、後読みの override JS はリリース対象から外す。
- ユーザーが初回から「今なにをしているか」「次に何をすればいいか」を迷わない体験にする。

## 2. 課金方針

### Store Requirement

- iOS: デジタル機能や広告非表示の解放は StoreKit / In-App Purchase を使う。
- Android: Google Play 配布では Google Play Billing を使う。
- 根拠:
  - Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines
  - Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/10281818

### Entitlement Source

最終的な有料判定は Firestore の `users/{uid}` を正とする。

Required fields:

- `isPremium`
- `subscriptionStatus`
- `premiumPlatform`
- `premiumProductId`
- `premiumExpiresAt`
- `appAccountToken`
- `updatedAt`

Client behavior:

- アプリ起動時に Firebase Auth の `uid` と `appAccountToken` をリンクする。
- StoreKit / Play Billing の購入・復元後にサーバー検証を行う。
- Firestore の `users/{uid}` を購読して UI を更新する。
- localStorage の `meimay_premium` は開発互換用に残す場合でも、本番 UI からは購入操作として見せない。

### Product

まずは 1 商品に絞る。

- Product: `meimay_premium_monthly`
- Type: auto-renewing subscription
- v1.1 では買い切りプランを入れない。

理由:

- 審査と実装の分岐を減らす。
- 復元、期限切れ、返金、請求リトライの確認範囲を絞る。
- 初期の課金価値を検証しやすい。

## 3. Free / Premium Boundary

無料で残す:

- 読み検索
- 響き検索
- 基本の直感スワイプ
- 漢字検索の基本
- 名前ビルド
- 姓名判断の基本
- 保存の基本
- ペアリング基本
- 今日の一字

Premium で解放する:

- 広告非表示
- 読みスワイプの 1 日上限解除
- 漢字スワイプの 1 日上限解除
- AI 漢字深掘りの上限緩和
- 人名用漢字を含む拡張候補
- ペアの一致分析
- 最終候補管理
- メモ / コメント

v1.1 に入れない:

- 複数課金プラン
- 外部決済
- PDF / 画像エクスポート
- 高度な占い・診断の多段メニュー

## 4. First Run UX

長い説明型チュートリアルではなく、短い初回導入と画面内の文脈ガイドで進める。

### Initial Guide

初回だけ 4 ステップで見せる。

1. 響きや読みを探す
2. 気になる漢字を集める
3. 名前を組み立てる
4. 保存して二人で比べる

Rules:

- 30 秒以内で終わる。
- いつでもスキップできる。
- 設定から再表示できる。
- 説明文を増やしすぎず、次のボタン名を具体的にする。

### Home

ホームはメニューではなく「次の一手」を出す。

State examples:

- 何もない: `まずは響きから探しましょう` / `響きを探す`
- 読みがある: `気になる読みに合う漢字を集めましょう` / `漢字を探す`
- 漢字がある: `集めた漢字で名前を作れます` / `名前を組み立てる`
- 保存名がある: `候補を見比べて絞り込みましょう` / `候補を見る`

### Swipe

スワイプ画面には常に以下を出す。

- 今の目的: `「みお」に合う1文字目を選んでいます`
- 操作: `右: 残す / 左: 見送る / 上: 本命`
- 残り: `あと12枚`
- 区切り: `3字ストックしました。次は2文字目を選びます`

## 5. Legal / Store Assets

Required public pages:

- Privacy Policy
- Terms
- Support
- Data deletion instructions

Store submission:

- App name
- Subtitle / short description
- Full description
- Keywords
- Screenshots
- Review notes
- Test account or review path

Privacy must mention:

- Firebase Auth
- Firestore
- Pairing data
- Saved names and preferences
- Gemini / AI request handling
- AdMob / advertising SDK
- Purchase status and subscription metadata
- Data deletion request flow

## 6. Implementation Order

### Phase 0: Repo Hygiene

- No override files.
- No duplicate live definitions in the same JS file.
- `rg` works and is the default search tool.
- Touched JS files pass syntax check.

### Phase 1: Entitlement Contract

- Define final `users/{uid}` premium schema.
- Remove user-facing dummy premium activation.
- Keep premium UI as read-only until real StoreKit / Play Billing is wired.
- Add tests or scripts for premium state mapping where practical.

### Phase 2: Native Shell

- Add Capacitor.
- Create iOS / Android projects.
- Fix bundle id / package name.
- Confirm Firebase and deep link behavior in native shells.

### Phase 3: Billing

- iOS StoreKit purchase and restore.
- App Store Server Notifications verification.
- Android Play Billing purchase and restore.
- Server-side verification and Firestore entitlement update.
- Expired / refunded / billing retry states.

### Phase 4: UX Brush-up

- Home next-action UI.
- Swipe purpose and gesture labels.
- Empty states that tell the next action.
- Settings entry to replay guide.
- Button labels changed from nouns to actions.

### Phase 5: Legal and Store

- Publish legal/support pages.
- Fill App Store privacy and Google Play Data Safety consistently.
- Prepare screenshots and review notes.

### Phase 6: QA

- New user first run.
- Existing user with saved data.
- Free user limits.
- Premium active.
- Premium expired.
- Purchase restore.
- Offline / slow network.
- Pairing disconnected / connected.
- iPhone small / large.
- Android small / large.

## 7. Immediate Next Tasks

1. Finish premium code cleanup and verify no duplicate live definitions.
2. Implement Home next-action state.
3. Implement Swipe purpose labels and remaining count.
4. Decide exact premium limits for free users.
5. Add Capacitor and native app identifiers.
6. Wire real StoreKit first, then Play Billing.
