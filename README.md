# LTイベント リアクションシステム

LTイベント中に参加者がコメント・質問・アンケート回答を投稿し、会場スクリーンにリアルタイム表示するWebアプリケーション。

---

## ファイル構成

```
lt-reaction/
├── index.html              # 参加者用 コメント投稿画面
├── display.html            # 会場スクリーン用 表示画面
├── admin.html              # 主催者用 管理画面(認証あり)
├── css/
│   ├── style.css           # 共通スタイル
│   └── display.css         # 表示画面専用スタイル
├── js/
│   ├── firebase-config.js  # Firebase設定 ← ここに設定値を入力
│   ├── comment-renderer.js # コメント描画コンポーネント(共通)
│   ├── post.js             # 投稿画面ロジック
│   ├── display.js          # 表示画面ロジック
│   └── admin.js            # 管理画面ロジック
└── README.md               # 本ファイル
```

---

## セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセスしてプロジェクトを作成
2. プロジェクトに **Webアプリ** を追加(`</> アイコン`から)
3. 表示される `firebaseConfig` の中身をコピー

### 2. Firebase設定の貼り付け

`js/firebase-config.js` を開き、`firebaseConfig` オブジェクトに取得した値を貼り付け。

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 3. Cloud Firestore の有効化

1. Firebase Console > **Firestore Database** を開く
2. 「データベースを作成」をクリック
3. **本番環境モード** または **テストモード** で開始(後でセキュリティルールを設定)
4. リージョンを選択(例: `asia-northeast1` 東京)

### 4. Authentication の有効化

1. Firebase Console > **Authentication** を開く
2. 「始める」をクリック
3. **Sign-in method** タブ > **メール/パスワード** を **有効** にする
4. **Users** タブ > 「ユーザーを追加」で管理者アカウントを作成
   - 例: `admin@example.com` / `password123`

### 5. セキュリティルールの設定

Firestore > ルール タブで以下を設定:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // コメント:誰でも投稿可、削除・更新は認証済みのみ
    match /comments/{commentId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }

    // アンケート設問:読み取りは誰でも、書き込みは認証済みのみ
    match /surveys/{surveyId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // アンケート回答:読み取り・作成は誰でも
    match /responses/{responseId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }

    // アプリ状態:読み取りは誰でも、書き込みは認証済みのみ
    match /appState/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 6. インデックスの作成

このアプリは複合インデックスが必要なクエリを使っています。
初回起動時にコンソールでエラーが表示され、自動的にインデックス作成リンクが提示されるので、それをクリックしてインデックスを作成してください。

事前に作成する場合は Firestore > インデックス タブから以下を作成:

| コレクション | フィールド1 | フィールド2 | クエリスコープ |
|---|---|---|---|
| `comments` | `isHidden` (昇順) | `createdAt` (降順) | コレクション |
| `surveys` | `isActive` (昇順) | `order` (昇順) | コレクション |

### 7. 動作確認

ローカルでHTMLファイルを開くか、簡易サーバーで起動:

```bash
# Python3がある場合
python3 -m http.server 8000
# → http://localhost:8000 にアクセス
```

各画面のURL:
- 参加者用: `http://localhost:8000/index.html`
- 会場表示用: `http://localhost:8000/display.html`
- 管理画面: `http://localhost:8000/admin.html`

---

## Firestoreデータ構造まとめ

### コレクション一覧

| コレクション名 | 用途 | ドキュメントID |
|---|---|---|
| `comments` | 参加者のコメント | 自動生成 |
| `surveys` | アンケート設問 | 自動生成 |
| `responses` | アンケート回答 | 自動生成 |
| `appState` | アプリ全体の状態 | **`current` (固定)** |

---

### 各コレクションのフィールド定義

#### `comments` コレクション

| フィールド名 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `text` | string | ○ | - | コメント本文(最大200文字) |
| `name` | string | ○ | "匿名" | 投稿者名 |
| `isQuestion` | boolean | ○ | false | 質問タグ |
| `createdAt` | timestamp | ○ | serverTimestamp | 投稿日時 |
| `likeCount` | number | △ | 0 | いいね数(B案拡張用) |
| `isHidden` | boolean | △ | false | 非表示フラグ(モデレーション用) |

**サンプル:**
```json
{
  "text": "とても勉強になりました!",
  "name": "山田",
  "isQuestion": false,
  "createdAt": "2026-06-15T14:30:00Z",
  "likeCount": 0,
  "isHidden": false
}
```

---

#### `surveys` コレクション

| フィールド名 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `question` | string | ○ | - | 質問文 |
| `type` | string | ○ | "radio" | "radio" または "checkbox" |
| `options` | array&lt;string&gt; | ○ | - | 選択肢の配列 |
| `isActive` | boolean | ○ | false | 公開中かどうか |
| `order` | number | ○ | 1〜 | 表示順序 |
| `createdAt` | timestamp | ○ | serverTimestamp | 作成日時 |

**サンプル:**
```json
{
  "question": "今日のLTで一番印象的だったテーマは?",
  "type": "radio",
  "options": ["フロントエンド", "バックエンド", "デザイン", "キャリア"],
  "isActive": true,
  "order": 1,
  "createdAt": "2026-06-15T13:00:00Z"
}
```

---

#### `responses` コレクション

| フィールド名 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `surveyId` | string | ○ | - | `surveys` のドキュメントID |
| `selectedOptions` | array&lt;string&gt; | ○ | - | 選択された選択肢の配列 |
| `createdAt` | timestamp | ○ | serverTimestamp | 回答日時 |

**サンプル(ラジオボタン):**
```json
{
  "surveyId": "abc123xyz",
  "selectedOptions": ["フロントエンド"],
  "createdAt": "2026-06-15T14:35:00Z"
}
```

**サンプル(チェックボックス):**
```json
{
  "surveyId": "def456uvw",
  "selectedOptions": ["フロントエンド", "デザイン"],
  "createdAt": "2026-06-15T14:36:00Z"
}
```

**※** 1人1回の制限は LocalStorage で管理(`survey_response_{surveyId}` というキーで保存)

---

#### `appState` コレクション

**ドキュメントIDは `current` で固定**

| フィールド名 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `displayMode` | string | ○ | "comments" | "comments" または "survey" |
| `displayStyle` | string | △ | "list" | 表示スタイル(将来の拡張用) |
| `updatedAt` | timestamp | ○ | serverTimestamp | 最終更新日時 |

**サンプル:**
```json
{
  "displayMode": "comments",
  "displayStyle": "list",
  "updatedAt": "2026-06-15T14:00:00Z"
}
```

**※** `appState/current` ドキュメントは管理画面初回表示時に自動で作成されます。

---

## 初期データの登録について

このアプリは初回起動時にデータを自動で作成するため、**事前に手動でドキュメントを登録する必要はありません**。

ただし、もし手動で動作確認用データを入れたい場合は、Firebase Console > Firestore Database から各コレクションにドキュメントを追加できます。

---

## 動作フロー

### イベント開始前
1. 管理者が `admin.html` でログイン
2. アンケートを事前に作成しておく(`isActive: false` のまま)
3. `display.html` を会場スクリーンに投影

### イベント中(コメント収集)
1. 参加者が `index.html` でコメント投稿
2. `display.html` にリアルタイム表示

### イベント中(アンケート実施)
1. 管理画面でアンケートを「公開する」
2. 管理画面で表示モードを「アンケート結果表示」に切替
3. 参加者の画面にアンケートが出現
4. 参加者が回答 → 会場スクリーンに集計結果がリアルタイム反映

---

## 将来の拡張(B案)

`index.html` の投稿画面に、他の参加者のコメント一覧も表示する拡張。
コメント描画ロジックは `js/comment-renderer.js` に分離してあるため、
`index.html` に表示エリアを追加し、`post.js` で `db.collection('comments').onSnapshot(...)` を購読、
`renderDisplayComment` または `renderAdminComment` を呼び出すだけで対応可能。

その他、`comments` コレクションには `likeCount` `isHidden` フィールドを最初から用意しているため、
いいね機能やモデレーション機能もデータ移行なしで追加できます。
