# 🐑 メイメー (Meimay)

**めぇ〜っと見つかる、運命の名前**

赤ちゃんの名付けを楽しくサポートする、羊みたいに優しい命名アプリ

---

## ✨ 主な機能

- 📱 **Tinder風スワイプUI** - 楽しく漢字を選べる
- 🔮 **本格姓名判断** - 五行・三才配置による鑑定
- 🤖 **AI由来生成** - Gemini AIが名前の由来を自動作成
- 💾 **ローカル保存** - ブラウザに候補を保存
- 📊 **2999文字の漢字データ** - 詳細な意味・画数情報
- 📱 **PWA対応** - スマホのホーム画面に追加してアプリとして使える

---

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone <your-repo-url>
cd baby-name-builder
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`を`.env`にコピー：

```bash
cp .env.example .env
```

`.env`ファイルを編集してAPIキーを設定：

```env
GEMINI_API_KEY=あなたのGemini APIキー
```

**Gemini APIキーの取得方法：**
1. https://makersuite.google.com/app/apikey にアクセス
2. 「APIキーを作成」をクリック
3. 生成されたキーを`.env`に貼り付け

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く

---

## 🌐 本番デプロイ（Vercel）

### 初回デプロイ

```bash
# Vercel CLIでログイン
npx vercel login

# デプロイ
npx vercel --prod
```

### 環境変数の設定（Vercel Dashboard）

1. https://vercel.com でプロジェクトを開く
2. **Settings** → **Environment Variables**
3. `GEMINI_API_KEY` を追加

デプロイ完了後、`https://あなたのプロジェクト名.vercel.app` でアクセス可能

---

## 📱 PWA（アプリ化）の使い方

### iPhoneの場合：
1. Safariでサイトを開く
2. 共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」を選択
4. 完成！ホーム画面にアイコンが追加されます

### Androidの場合：
1. Chromeでサイトを開く
2. メニュー（⋮）をタップ
3. 「ホーム画面に追加」を選択
4. 完成！

---

## 📁 プロジェクト構造

```
baby-name-builder/
├── public/
│   ├── index.html          # メインHTML
│   └── manifest.json       # PWA設定
├── src/
│   ├── js/
│   │   ├── core.js         # グローバル状態管理
│   │   ├── engine.js       # 名前分割エンジン
│   │   ├── fortune.js      # 姓名判断ロジック
│   │   ├── ui-flow.js      # 画面遷移管理
│   │   ├── ui-render.js    # カード描画
│   │   ├── ui-physics.js   # スワイプ物理演算
│   │   ├── build-ui.js     # ビルド画面UI
│   │   ├── build-action.js # ビルドアクション
│   │   ├── fortune-view.js # 姓名判断表示
│   │   ├── origin.js       # AI由来生成
│   │   └── storage.js      # ローカルストレージ
│   ├── styles/
│   │   └── main.css        # スタイル定義
│   └── data/
│       └── kanji_data.json # 漢字マスタ（2999件）
├── api/
│   └── gemini.js           # Gemini API呼び出し
├── package.json
├── vercel.json             # Vercelデプロイ設定
└── README.md
```

---

## 🎮 使い方

1. **性別・読みを入力** → 例：「ゆうと」
2. **分け方を選択** → 例：「ゆう/と」「ゆ/うと」
3. **名字を入力（任意）** → 姓名判断に使用
4. **スワイプで漢字選び**
   - 👈 左スワイプ：スキップ
   - 👉 右スワイプ：保存
   - 👆 上スワイプ：お気に入り
5. **ビルド画面で組み立て** → 選んだ漢字を組み合わせ
6. **姓名判断を確認** → 五格・三才配置
7. **AI由来を生成** → Geminiが名前の由来を作成
8. **保存してパートナーと共有**

---

## 🔧 技術スタック

- **フロントエンド**: Vanilla JavaScript + Tailwind CSS
- **バックエンド**: Vercel Serverless Functions
- **AI**: Google Gemini API
- **ストレージ**: LocalStorage
- **デプロイ**: Vercel
- **PWA**: Service Worker + Web App Manifest

---

## 🐛 トラブルシューティング

### APIエラーが出る
- `.env`ファイルのAPIキーを確認
- Gemini APIの利用制限を確認（無料枠：月15リクエスト）

### 漢字データが読み込めない
- `src/data/kanji_data.json`が存在するか確認
- ブラウザのコンソールでエラーを確認（F12キー）

### ローカル開発サーバーが起動しない
```bash
# ポート3000が使用中の場合
PORT=3001 npm run dev
```

### スワイプが動かない
- タッチイベントが有効か確認
- ブラウザのコンソールでエラーを確認

---

## 📝 ライセンス

MIT License

---

## 🙏 謝辞

- **漢字データ**: 各種漢字辞典を参考に独自編集
- **AI**: Google Gemini API
- **UI**: Tailwind CSS
- **フォント**: Zen Maru Gothic

---

## 📞 サポート

問題や質問がある場合は、GitHubのIssuesでお知らせください。

---

**楽しい名付けライフを！** 🐑✨

#メイメー #meimay #赤ちゃんの名前 #命名アプリ
.
