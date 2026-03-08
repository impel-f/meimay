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

## 2. Firebase Functions の役割

今回追加した Functions は Apple App Store Server Notifications V2 を受け取り、JWS を検証したうえで Firestore の `users/{uid}` を更新します。

- Function 名: `handleAppStoreNotification`
- 役割:
  - `signedPayload` を検証
  - `bundleId` が `com.impelf.meimay` と一致するか確認
  - `appAccountToken` をもとに `users/{uid}` を特定
  - `isPremium` / `subscriptionStatus` を更新

クライアントは匿名 Firebase Auth の `uid` で `users/{uid}` を持ちつつ、Apple 決済用に `appAccountToken(UUID)` も同じドキュメントへ保存します。

## 3. Firebase Secrets / Params

Functions をデプロイする前に、Secret は CLI で、String params は `functions/.env.<projectId>` かデプロイ時の対話入力で設定します。

Secret の登録:

```bash
firebase functions:secrets:set APPLE_IAP_ENCODED_KEY
```

params は次のような `functions/.env.<projectId>` を作るのが分かりやすいです。

```dotenv
APPLE_IAP_KEY_ID=YOUR_KEY_ID
APPLE_IAP_ISSUER_ID=YOUR_ISSUER_ID
APPLE_IAP_BUNDLE_ID=com.impelf.meimay
APPLE_IAP_APPLE_ID=1234567890
APPLE_IAP_ENVIRONMENT=Sandbox
```

`.env.<projectId>` を置かない場合は、`firebase deploy --only functions` の実行時に CLI が値を聞いてきます。

入力値の目安:

- `APPLE_IAP_BUNDLE_ID`: `com.impelf.meimay`
- `APPLE_IAP_ENVIRONMENT`: `Sandbox` から開始
- `APPLE_IAP_APPLE_ID`: App Store Connect の Apple ID
- `APPLE_IAP_ENCODED_KEY`: `.p8` ファイルの中身そのもの

`APPLE_IAP_KEY_ID` / `APPLE_IAP_ISSUER_ID` / `APPLE_IAP_ENCODED_KEY` は、将来 App Store Server API を呼ぶ時にもそのまま使えます。

## 4. デプロイ

`functions/` ディレクトリで実行します。

```bash
npm install
npm run build
firebase deploy --only functions
```

デプロイ後、通知 URL は次の形になります。

```text
https://asia-northeast1-<your-project-id>.cloudfunctions.net/handleAppStoreNotification
```

この URL を App Store Connect の Server Notifications V2 に登録してください。

## 5. Firestore に入る主な項目

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

未リンクの通知は `billingPending/{notificationUUID}` に保留されます。

## 6. 今後の接続ポイント

まだ未実装のもの:

- 実際の StoreKit 購入フロー
- 購入時に `appAccountToken` を StoreKit 側へ渡す処理
- Android Play Billing 側のサーバー通知

今回の実装で、Apple 側のサーバー通知受信と Firestore 反映の土台は先に用意できています。
