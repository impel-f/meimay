# リリース前にユーザー確認が必要な項目

更新日: 2026-04-27

Codexだけで進めると本番アカウント、課金、公開情報、削除操作に触れるため、以下は後でユーザー確認してから実施する。

## 課金・ストア

- App Store Connect で `meimay_premium_monthly` を作成するか。
- Google Play Console で同じ月額商品の商品IDを `meimay_premium_monthly` にそろえるか。
- 月額価格、無料トライアル有無、初回価格の有無。
- iOS / Android の bundle id / package name を最終決定するか。
- StoreKit / Play Billing の本番接続をいつ有効化するか。
- 課金検証用のサーバー構成を Firebase Functions で進めるか、別サーバーにするか。
- 全ユーザー1回だけの3日無料プレミアムを、ストアの introductory offer として扱うか、アプリ内のサーバー付与 trial として扱うか。
- パートナー連携中でも無料プレミアムは個人単位で消費するルールでよいか。有料プレミアムは片方の課金で連携相手にも特典共有する。

## 公開ページ・法務

- 外部公開するサポートURL。
- 外部公開するプライバシーポリシーURL。
- 外部公開する利用規約URL。
- データ削除手順ページのURLと問い合わせ先。
- Firebase Auth、Firestore、AdMob、Gemini、課金状態、パートナー連携データを法務文面に含める内容。
- App Store のプライバシー項目と Google Play Data Safety の申告内容。

## ストア提出素材

- アプリ名、サブタイトル、短い説明、詳細説明、キーワード。
- スクリーンショットに使う端末サイズと画面。
- 審査メモに書く操作手順。
- 審査用アカウントを用意するか、ゲスト利用で通すか。

## 本番切り替え

- 本番用 Firebase プロジェクト / AdMob ID / APIキーを現在の設定のまま使うか。
- 広告IDが本番IDでよいか、審査前にテストIDへ切り替えるか。
- 既存データの扱い。リリース前に削除やリセットが必要な場合は、削除前に必ず確認する。
- main への細かい push は避け、まとまった確認後に push するか。
- Firestore rules ではクライアントから `users/{uid}` の `isPremium` は書けない。一方で、連携相手が古いバックアップ補完のために `users/{partnerUid}` を読める条件がある。`appAccountToken` や課金状態の共有範囲をこのままでよいか、リリース前に確認する。
- バックアップ復元は高エントロピー復元キー方式を正式方針にするか。`ID控え + 苗字一致` は本人確認として使わない。
- デプロイ後の本番 URL で `/api/backup-restore` の実通信確認を行う。復元キー発行時に `users/{uid}` のバックアップ同期が成功し、別匿名UIDで同じ復元キーから統合復元できることを確認する。
- パートナーが `users/{partnerUid}` を丸ごと読む補完経路を、将来 `rooms/{roomId}/data/{uid}` だけに縮小するか。

## 実データを伴うQA

- パートナー連携のルーム作成を本番Firestoreで試すか。
- ルームコード参加を本番Firestoreで試すか。
- 連携解除、保存候補削除、ストック全消去、子ども情報削除などの削除系QAをどのデータで実施するか。
- 課金状態の本番確認ボタンを実アカウントで押してよいタイミング。

## 依存関係

- `npm audit --omit=dev` で 15件の脆弱性が検出された。`npm audit fix` は依存更新を伴うため、実行前に確認する。
- `firebase-admin` は `13.7.0` から `13.8.0` へ更新候補あり。
- `@google/generative-ai` は `0.21.0` から `0.24.1` へ更新候補あり。
- `xlsx` は高リスク指摘があるが npm audit 上は修正版なし。リリース前に利用範囲と代替方針を確認する。
- `protobufjs` の critical 指摘は推移依存に含まれる。Functions / 管理スクリプト側の利用範囲を確認してから更新する。
- `functions/` でも `npm audit --omit=dev` で 16件の脆弱性が検出された。
- `functions/` の更新候補は `firebase-admin 13.8.0`、`firebase-functions 7.2.5`、`@apple/app-store-server-library 3.0.0`。特に Apple library のメジャー更新は課金通知検証に影響するため、実装差分を見てから判断する。
