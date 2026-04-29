# App Store / Firebase 課金セットアップ

メイメーは 2026年3月8日 時点で Web / Firebase 構成です。`ios/Info.plist` はまだ存在しないため、このドキュメントの手順をネイティブ化後に反映してください。

## 1. Info.plist に追加する項目

App Store Connect の輸出コンプライアンス確認を簡略化するため、iOS プロジェクト作成後に `Info.plist` へ以下を追加します。

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Xcode の `Info` タブで設定する場合は以下です。

- Key: `App Uses Non-Exempt Encryption`
- Type: `Boolean`
- Value: `NO`

通常の HTTPS / Firebase / Apple 標準ライブラリ利用であれば、追加の書類提出は不要なケースがほとんどです。

## 2. 課金通知の受信口

Apple App Store Server Notifications V2 用の Firebase Functions 実装は `functions/` に残しています。ただし `meimay-9a28f` は現時点で Blaze プランではないため、RevenueCat Webhook は Vercel API で受ける構成を本命にします。

- Function 名: `handleAppStoreNotification`
- 役割:
  - `signedPayload` を検証
  - `bundleId` が `com.impelf.meimay` と一致するか確認
  - `appAccountToken` をもとに `users/{uid}` を特定
  - `isPremium` / `subscriptionStatus` を更新

クライアントは匿名 Firebase Auth の `uid` で `users/{uid}` を持ちつつ、Apple 決済用に `appAccountToken(UUID)` も同じドキュメントへ保存します。

RevenueCat 経由の購入では、RevenueCat Webhook も受け取ります。

- 本番 URL: `https://<your-vercel-domain>/api/revenuecat-webhook`
- ローカル対応ファイル: `api/revenuecat-webhook.js`
- 役割:
  - RevenueCat Webhook の `Authorization` を検証
  - `app_user_id` を Firebase Auth の `uid` として扱う
  - `premium` entitlement / `meimay.premium.*` 商品をもとに `isPremium` / `subscriptionStatus` を更新
  - 非更新パスの `expiration_at_ms` がない場合は、商品IDから 1か月 / 3か月の期限を補完

## 3. RevenueCat Webhook 用の環境変数

Vercel 側に次を設定します。

```dotenv
REVENUECAT_WEBHOOK_AUTH=任意の長い秘密文字列
REVENUECAT_ENTITLEMENT_ID=premium
```

`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`、または `FIREBASE_SERVICE_ACCOUNT_JSON` は、既存の `/api/backup-restore` と同じ Firebase Admin 設定を使います。

RevenueCat の Webhook 設定では、URL に `/api/revenuecat-webhook` を指定し、Authorization に `REVENUECAT_WEBHOOK_AUTH` と同じ値を入れます。

## 4. Firebase Functions を使う場合の Secrets / Params

将来 Firebase Functions 側へ戻す場合は、Firebase プロジェクトを Blaze プランへ上げたうえで Secret Manager を使います。Functions をデプロイする前に、Secret は CLI で、String params は `functions/.env.<projectId>` かデプロイ時の対話入力で設定します。

Secret の登録:

```bash
firebase functions:secrets:set APPLE_IAP_ENCODED_KEY
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
```

params は次のような `functions/.env.<projectId>` を作るのが分かりやすいです。

```dotenv
APPLE_IAP_KEY_ID=YOUR_KEY_ID
APPLE_IAP_ISSUER_ID=YOUR_ISSUER_ID
APPLE_IAP_BUNDLE_ID=com.impelf.meimay
APPLE_IAP_APPLE_ID=1234567890
APPLE_IAP_ENVIRONMENT=Sandbox
REVENUECAT_ENTITLEMENT_ID=premium
```

`.env.<projectId>` を置かない場合は、`firebase deploy --only functions` の実行時に CLI が値を聞いてきます。

入力値の目安:

- `APPLE_IAP_BUNDLE_ID`: `com.impelf.meimay`
- `APPLE_IAP_ENVIRONMENT`: `Sandbox` から開始
- `APPLE_IAP_APPLE_ID`: App Store Connect の Apple ID
- `APPLE_IAP_ENCODED_KEY`: `.p8` ファイルの中身そのもの
- `REVENUECAT_WEBHOOK_AUTH`: RevenueCat Webhook の Authorization に設定する任意の長い秘密文字列

`APPLE_IAP_KEY_ID` / `APPLE_IAP_ISSUER_ID` / `APPLE_IAP_ENCODED_KEY` は、将来 App Store Server API を呼ぶ時にもそのまま使えます。

## 5. デプロイ

Vercel API の反映は通常の本番デプロイで行います。

```bash
npm run deploy
```

Firebase Functions を使う場合のみ、`functions/` ディレクトリで実行します。

```bash
npm install
npm run build
firebase deploy --only functions
```

デプロイ後、通知 URL は次の形になります。

```text
https://asia-northeast1-<your-project-id>.cloudfunctions.net/handleAppStoreNotification
https://asia-northeast1-<your-project-id>.cloudfunctions.net/handleRevenueCatWebhook
```

App Store Connect の Server Notifications V2 には `handleAppStoreNotification` を、RevenueCat の Webhook には本命ルートの `/api/revenuecat-webhook` を登録してください。

## 6. Firestore に入る主な項目

Apple 通知が通ると `users/{uid}` に次のような項目が入ります。

- `appAccountToken`
- `isPremium`
- `subscriptionStatus`
- `appStoreProductId`
- `appStoreOriginalTransactionId`
- `appStoreTransactionId`
- `appStoreExpiresAt`
- `appStoreLastNotificationType`
- `appStoreUpdatedAt`
- `revenueCatAppUserId`
- `revenueCatLastEventType`
- `revenueCatProductId`
- `revenueCatUpdatedAt`

未リンクの通知は `billingPending/{notificationUUID}` に保留されます。
RevenueCat Webhook のイベント履歴は `revenueCatEvents/{eventId}` に保存されます。

## 7. 今後の接続ポイント

まだ未実装のもの:

- ネイティブ実機での StoreKit 購入フロー確認
- 購入時に `appAccountToken` を StoreKit 側へ渡す処理
- Android Play Billing 側のサーバー通知

今回の実装で、Apple 側のサーバー通知受信と Firestore 反映の土台は先に用意できています。
