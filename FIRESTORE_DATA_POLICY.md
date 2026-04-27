# Firestore保存・復元・無料プレミアム運用ルール

最終更新: 2026-04-27

## 前提

- Cloud Firestore の無料枠は公式ドキュメント上、保存 1 GiB、読み取り 50,000 回/日、書き込み 20,000 回/日、削除 20,000 回/日、外向き転送 10 GiB/月。無料枠はプロジェクト内の 1 database にだけ適用され、日次でリセットされる。
- リアルタイム listener は、対象ドキュメントが追加・更新・結果セットから外れたときに read が発生する。Security Rules の `get()` / `exists()` による依存ドキュメント読み取りも課金対象になる。
- そのため「ほぼリアルタイム」は維持しつつ、Firestore に送る内容は「ユーザーの意思決定」だけに絞る。マスタから復元できる表示情報は送らない。

参考:
- https://firebase.google.com/docs/firestore/pricing
- https://firebase.google.com/docs/firestore/query-data/listen
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## 現行確認

- 端末内保存は `localStorage` が正。`StorageBox.saveAll/saveLiked/saveSavedNames` と `saveReadingStock` で即時保存する。
- 個人バックアップは `users/{uid}` に 5 秒デバウンスで同期し、60 秒ごとの保険同期もある。内容 fingerprint が同じなら再送しない。
- パートナー同期は `rooms/{roomId}/data/{uid}` に 3 秒デバウンスで同期し、相手は同じ doc を listener で購読する。
- `liked`、`savedNames`、`readingStock`、`encounteredReadings` は `MeimayFirestorePayload` で minify/hydrate する実装になっている。
- 今回の見直しで、子ワークスペース `meimayStateV2` も同期時に同じ minify 経路へ通すようにした。画数・意味・タグ・例などのマスタ由来データは、復元時にローカルマスタから補完する。
- 30秒ごとの端末内自動保存はパートナー同期を予約しない。出会った候補の記録も、通常はパートナー同期を予約しない。
- パートナー同期の相手側 fallback 読み取りは、room doc の主要配列フィールドや `meimayStateV2` が欠損している旧データ補完時に限る。空配列は「同期済みの空状態」として扱い、毎回 `users/{partnerUid}` を読まない。
- 隠し読み、削除済みストックキー、プロフィール、公開プレミアム状態は room sync の fingerprint に含める。これらの意思決定だけが変わった場合も、`updatedAt` だけの変化として捨てない。

## Firestoreに送るもの

送ってよいもの:
- 漢字ストック: 漢字、slot、sessionReading、読み分割、性別、本命フラグ、保存時刻。
- 読みストック: id、reading、segments、baseNickname、性別、本命フラグ、由来、保存時刻。
- 保存済み名前: fullName、givenName、reading、combinationKeys、メモ、由来、本命選択フラグ、保存時刻。
- 子ワークスペース: 子の識別子、出生順・双子情報、予定日、設定、保存キャンバスの選択キー、各ライブラリの minify 済みデータ。
- パートナー同期に必要な公開プレミアム状態: 有効/無効、ステータス、期限、商品ID。購入トークンや検証イベントの詳細は送らない。

送らないもの:
- 漢字マスタから復元できる画数、意味、分類、タグ、説明文。
- 読みマスタから復元できるタグ、例、表示ラベル。
- 画数診断の計算結果。必要な場面で再計算する。
- AI説明キャッシュ、読み履歴、見送り履歴、作業中のビルド draft、表示用だけの一時状態。
- 候補カードを1枚めくるたびの逐次イベント。ランキング用の集計は API 側で必要最小限の increment にする。

## 書き込み頻度

- ユーザー操作直後は `localStorage` に即時保存する。
- Firestore 同期はデバウンスでまとめる。小さな連続操作を 1 回の `set(..., { merge: true })` に畳む。現行はパートナー同期 3 秒、個人バックアップ 5 秒。
- `updatedAt` だけの変化では送らない。fingerprint は同期対象の実データだけで作る。
- パートナー listener は更新ごとに相手側 read が発生するため、パートナー同期へ流す対象は「ストック・保存・本命・プロフィール・公開プレミアム」に限る。
- 読みをストックから外して隠す操作は、パートナー同期・個人バックアップの同じデバウンス経路へ流す。読みカードを見ただけの履歴や日次カウンタは送らない。
- 無料枠目安: 20,000 writes/日なので、1,000 DAU なら 1人あたり 20 writes/日で上限に届く。初期は 100から300 DAU 程度なら余裕があるが、ランキング・パートナー・バックアップを合算して見る。
- DAU が増えたら、個人バックアップは 10から15 秒デバウンス、パートナー同期は 5 秒前後、最大待ち時間 15から30 秒の設計へ寄せる。

## 復元ルール

ID控え + 苗字一致だけで復元はしない。UID は秘密情報ではなく、苗字も推測・共有されやすいので、バックアップ復元の認証としては弱い。

推奨ルール:
- 端末内の通常復元は Firebase Auth の匿名 UID 継続を前提にする。
- サーバー復元は高エントロピー復元キー方式にする。復元キーはサーバー側でハッシュ化して保存し、平文はユーザーの端末にだけ残す。
- 端末を失った場合も、ユーザー向けの正式な自己復元手段は復元キーに寄せる。JSONバックアップは通常UIには出さない。
- 復元キーの発行・再発行時は、現在の保存データを先にバックアップ同期する。同期に失敗した場合は、キー発行を成功扱いにしない。
- 苗字一致は本人確認ではなく、誤復元防止の確認表示にだけ使う。
- パートナー連携済みなら、既存パートナー端末の承認で復元できる導線を検討する。ただし片方の端末だけで相手の全バックアップを読める設計にはしない。
- `users/{uid}` をパートナーが丸ごと読める補完経路は将来縮小する。相手に見せるデータは `rooms/{roomId}/data/{uid}` に寄せる。

## 3日無料プレミアム案

方針:
- 全ユーザーに「任意のタイミングで1回だけ、3日間プレミアム」を付与する。
- 開始はユーザーのボタン操作で行う。
- 権限付与はクライアント保存ではなく、Cloud Functions または API でサーバー時刻を使って確定する。
- trial は `users/{uid}` のサーバー管理フィールドに保存し、クライアントから直接変更できないようにする。
- 現行実装では `/api/premium-trial` が Firebase ID token を検証し、Firestore Admin で trial を付与する。

推奨フィールド:
- `trialStartedAt`
- `trialEndsAt`
- `trialConsumedAt`
- `trialStatus`
- `trialSource`

パートナー消費ルール:
- 連携前に開始した場合、そのユーザーだけ trial を消費する。
- 連携中に開始した場合も、そのユーザーだけ trial を消費する。相手の無料枠は消費せず、相手を無料体験中扱いにもしない。
- 片方がすでに trial 消費済みでも、もう片方の trial は開始できる。
- 片方が有料プレミアム中なら、連携相手にもプレミアム特典を共有する。trial は開始せず、有料権限を優先する。

案内を出す場所:
- プレミアムモーダルの購入ボタンより上。
- 1日のスワイプ上限に達したとき。
- 初めて保存済み名前を作った後。
- パートナー連携完了後、自分が未消費なら個人の3日無料体験を案内する。
- 設定のプレミアム行。

ストア審査の確認:
- Apple はデジタル機能の有料解放に In-App Purchase を求める。自前の無料開放自体は課金ではないが、その後の購入導線・表記・無料トライアル扱いは審査前に確認する。
- App Store / Google Play の正式な無料トライアルとして扱う場合は、各ストアの subscription offer / introductory offer に寄せる。

参考:
- https://developer.apple.com/appstore/resources/approval/guidelines.html
- https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/
- https://developer.android.com/google/play/billing/billing_subscriptions
