# App Store / Firebase 課金セットアップ

メイメーは Web / Firebase 構成を土台に、Capacitor でネイティブ化する方針です。2026年4月29日時点で `capacitor.config.json`、Capacitor 本体、RevenueCat Capacitor SDK、iOS ネイティブプロジェクト、Codemagic 用 `codemagic.yaml` を追加済みです。手元に Mac がなくても、Codemagic で `ios/App/App.xcodeproj` をビルドして TestFlight へ配布する流れを本命にします。

## 0. ネイティブ化の現在地

追加済み:

- Capacitor appId: `com.impelf.meimay`
- Capacitor appName: `メイメー`
- webDir: `public`
- iOS project: `ios/App/App.xcodeproj`
- Xcode scheme: `App`
- Xcode Cloud script: `ios/App/ci_scripts/ci_post_clone.sh`
- Codemagic config: `codemagic.yaml`
- RevenueCat iOS Public SDK Key: `appl_iANPgUKzgQIuwcKXMrvmSKkxIhX`
- RevenueCat entitlement: `premium`
- RevenueCat offering: `default`

ローカルでネイティブプロジェクトを更新する場合:

```bash
npm run cap:add:android
npm run cap:sync
```

Windows で `npm run cap:sync` を実行すると、Swift Package のローカルパスが Windows 形式に戻る場合があります。Codemagic では `codemagic.yaml` が `npm ci` と `npx cap sync ios` を実行し、Mac 形式の状態へ再生成してからビルドします。

Codemagic ワークフロー:

- `ios-capacitor-smoke`: 署名なしで iOS プロジェクトがビルドできるか確認する
- `ios-testflight`: App Store Connect 連携で署名ファイルを作成・取得し、IPA を作成して App Store Connect へアップロードする

Codemagic の App Store Connect 連携:

- Integration name: `codemagic`
- Bundle ID: `com.impelf.meimay`
- App Store Apple ID: `6760251452`
- Environment group: `code-signing`
- Environment variable: `CERTIFICATE_PRIVATE_KEY`

Apple Developer で手動の Certificate Signing Request が求められる証明書作成画面は、Mac がある場合の手動ルートです。iPad だけで進める場合は、Codemagic の `ios-testflight` 内で `app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --certificate-key=@env:CERTIFICATE_PRIVATE_KEY --create` を実行し、App Store 配布用の証明書とプロビジョニングプロファイルを自動作成・取得します。

`CERTIFICATE_PRIVATE_KEY` は Codemagic の署名証明書作成用の秘密鍵です。リポジトリには入れず、Codemagic の Environment variables で Sensitive として保存します。

Xcode Cloud を使う場合の目安:

- Repository: GitHub の `impel-f/meimay`
- Branch: `main`
- Project: `ios/App/App.xcodeproj`
- Scheme: `App`
- Action: Archive
- Distribution: TestFlight

Android は Google Play Console 側の商品作成後に Public SDK Key を `public/js/14-admob.js` の `RevenueCatConfig.androidPublicSdkKey` へ入れます。

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

2026年4月29日時点の本番設定:

- URL: `https://meimay.vercel.app/api/revenuecat-webhook`
- Environment: Both Production and Sandbox
- App: All apps
- Event type: All events
- RevenueCat Test Event: HTTP 200 確認済み

RevenueCat の Test Event は疎通確認用で、Firestore の課金状態は更新しません。実購入イベントで `users/{uid}` と `revenueCatEvents/{eventId}` の更新を別途確認します。

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
- sandbox 実購入イベントで `users/{uid}` と `revenueCatEvents/{eventId}` が更新されるか確認
- Android Play Billing 側のサーバー通知

今回の実装で、Apple 側のサーバー通知受信と Firestore 反映の土台は先に用意できています。
