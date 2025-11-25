# Google Form History Chrome拡張機能 - 初心者向けリバース・エンジニアリング解説

## 📋 プロジェクト概要
このプロジェクトは、**Google Forms（Googleフォーム）の回答履歴を自動保存するChrome拡張機能**です。通常、Googleフォームは一度送信すると回答内容を確認することができませんが、この拡張機能により回答履歴をローカルに保存し、いつでも確認できるようになります。

## 🏗️ アーキテクチャ（システム全体の設計）

```
Google Forms（Webページ）
    ↓
Chrome拡張機能の動作
    ↓
1. Content Script（form.ts + answer.ts）
    ├── フォームの構造を取得
    └── ユーザーの回答を監視・保存
    ↓
2. Web Accessible Resources（web-accessible-resources.js）
    └── Googleの隠しデータを抽出
    ↓
3. Popup UI（App.tsx）
    └── 保存された履歴を表示・管理
    ↓
4. Chrome Storage API
    └── ローカルストレージに保存
```

## 📁 ファイル構成とそれぞれの役割

### 1. 設定・ビルド関連ファイル
- `package.json` - プロジェクトの依存関係とスクリプト定義
- `manifest.config.ts` - Chrome拡張機能の設定ファイル（権限、実行場所など）
- `vite.config.ts` - ビルドツールの設定
- `tsconfig.json` - TypeScriptの設定

### 2. コア機能ファイル
- `src/content/main.ts` - エントリーポイント（他のファイルを読み込む）
- `src/content/form.ts` - フォーム構造の取得・保存
- `src/content/answer.ts` - ユーザー回答の監視・保存
- `src/web-accessible-resources.js` - Googleの隠しデータ抽出

### 3. UI関連ファイル
- `src/popup/App.tsx` - 拡張機能のポップアップ画面（回答履歴表示）
- `src/popup/main.tsx` - Reactアプリのエントリーポイント
- `src/popup/index.html` - ポップアップのHTMLファイル

### 4. 共通ファイル
- `src/utils/types.ts` - TypeScriptの型定義
- `src/utils/utils.ts` - 共通関数

## 🔍 詳細なコード解析

### 1. manifest.config.ts - 拡張機能の設定
```typescript
export default defineManifest({
  manifest_version: 3,  // Chrome拡張機能のバージョン
  permissions: ["storage"],  // ローカルストレージへのアクセス許可
  content_scripts: [
    {
      js: ["src/content/main.ts"],
      matches: ["https://docs.google.com/forms/*"],  // Googleフォームでのみ実行
    },
  ],
  web_accessible_resources: [
    {
      resources: ["src/web-accessible-resources.js"],
      matches: ["https://docs.google.com/*"],  // Googleドキュメントサイトで実行
    },
  ],
});
```

**解説:**
- `content_scripts`: Webページに直接注入されるスクリプト
- `web_accessible_resources`: Webページから読み込み可能なリソース
- `permissions`: 拡張機能が使用する権限

### 2. form.ts - フォーム構造の取得

#### 2.1 隠しデータの抽出戦略
```typescript
// FB_PUBLIC_LOAD_DATA_ を取得するためにスクリプトを注入
(() => {
  const script = document.createElement("script");
  const filePath = chrome.runtime.getURL("src/web-accessible-resources.js");
  script.setAttribute("src", filePath);
  document.body.appendChild(script);
})();
```

**なぜこの仕組みが必要？**
- Googleフォームは `FB_PUBLIC_LOAD_DATA_` というグローバル変数にフォームの全情報を保存している
- Content ScriptはWebページとは分離された環境で実行されるため、直接この変数にアクセスできない
- `web-accessible-resources.js` をWebページに注入することで、この制限を回避

#### 2.2 web-accessible-resources.js の動作
```javascript
(() => {
  if (typeof FB_PUBLIC_LOAD_DATA_ === "undefined") {
    console.error("[google-form-history] FB_PUBLIC_LOAD_DATA_ is not defined.");
    return;
  }

  window.postMessage(
    {
      source: "google-form-history",
      payload: FB_PUBLIC_LOAD_DATA_,  // 隠しデータを送信
    },
    window.location.origin
  );
})();
```

**動作の流れ:**
1. Webページのコンテキストで実行される
2. `FB_PUBLIC_LOAD_DATA_` 変数にアクセス
3. `postMessage` でContent Scriptにデータを送信

#### 2.3 フォームデータの処理
```typescript
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== "https://docs.google.com" ||
    event.data?.source !== "google-form-history"
  ) {
    return;  // セキュリティチェック
  }

  try {
    const data = event.data.payload as GoogleFormPayload;
    
    // フォーム項目の解析
    const items = data[1][1].map((itemData: GoogleFormItemData) => {
      const tempItem: Item = {
        id: itemData[0],      // 項目ID
        headline: itemData[1], // 見出し
        label: itemData[2],    // ラベル
        questions: [],
      };
      // 選択肢などの詳細情報を処理...
      return tempItem;
    });

    const form: Form = {
      title: data[3],           // フォームタイトル
      path: getFormId(data[14]), // フォームID
      items,
    };

    // ローカルストレージに保存
    const localForms: Record<string, Form> = localFormsData ?? {};
    localForms[form.path] = form;
    chrome.storage.local.set({ forms: localForms });
  } catch (e) {
    console.error("[google-form-history] Failed to parse data", e);
  }
});
```

### 3. answer.ts - 回答データの監視・保存

#### 3.1 回答データの取得戦略
Googleフォームは回答データを2箇所に保存します:

1. **隠しinput要素** - 現在ページの回答
```typescript
const inputs = document.querySelectorAll("input[type='hidden']");
for (const input of inputs) {
  if (input instanceof HTMLInputElement) {
    if (input.name.startsWith("entry.")) {
      const key = input.name.split(".")[1];
      addAnswer(key, input.value);
    }
  }
}
```

2. **partialResponse要素** - 前ページまでの回答
```typescript
const input = document.querySelector("[name='partialResponse']");
if (input instanceof HTMLInputElement) {
  const value = JSON.parse(input.value)[0];
  for (const item of value) {
    const key = item[1].toString();
    addAnswer(key, item[2]);
  }
}
```

#### 3.2 回答データの種類別処理
```typescript
const addAnswer = (key: string, value: string) => {
  const id = key.split("_")[0];

  // 日時データの処理
  const isYear = key.endsWith("year");
  const isMonth = key.endsWith("month");
  const isDay = key.endsWith("day");

  if (isYear || isMonth || isDay) {
    if (!answers[id] || answers[id].type !== "date") {
      answers[id] = { type: "date", year: 0, month: 0, day: 0 };
    }
    // 年月日を個別に設定...
  }

  // 時間データの処理
  // テキストデータの処理
  // など...
};
```

#### 3.3 リアルタイム監視システム
```typescript
const observer = new MutationObserver(() => {
  saveAnswers();  // フォームが変更されるたびに回答を保存
});
const form = document.querySelector("form");
if (form) {
  observer.observe(form, {
    subtree: true,    // 子要素の変更も監視
    attributes: true, // 属性の変更も監視
  });
}
```

**MutationObserver の役割:**
- DOMの変更を監視するAPI
- フォームの入力内容が変わるたびに自動的に `saveAnswers()` を実行
- ユーザーが入力中にリアルタイムで回答を保存

### 4. App.tsx - UI（ユーザーインターフェース）

#### 4.1 データの表示ロジック
```typescript
const [displayAnswers, setDisplayAnswers] = useState<DisplayAnswer[]>([]);

useEffect(() => {
  const loadData = async () => {
    // ローカルストレージからフォームデータと回答データを取得
    const formsData = (await chrome.storage.local.get("forms")).forms as LocalForms;
    const answersData = (await chrome.storage.local.get("answers")).answers as LocalAnswers;
    
    // フォーム情報と回答情報をマージして表示用データを作成
    const display: DisplayAnswer[] = [];
    for (const [key, formAnswers] of Object.entries(answersData ?? {})) {
      const form = formsData?.[formAnswers.formId];
      if (form) {
        // フォーム項目と回答をマッチング
        const items: DisplayItem[] = form.items.map((item) => ({
          headline: item.headline,
          label: item.label,
          answer: answerToString(formAnswers.answers[item.id]),
        }));
        
        display.push({
          formId: formAnswers.formId,
          fbzx: formAnswers.fbzx,
          date: formAnswers.date,
          title: form.title,
          items,
        });
      }
    }
    
    setDisplayAnswers(display);
  };
  
  loadData();
}, []);
```

## 🎯 キーとなる技術的な仕組み

### 1. Chrome拡張機能のセキュリティモデル
- **Content Scripts**: Webページに注入されるが、分離された環境で実行
- **Web Accessible Resources**: Webページから直接読み込み可能
- **PostMessage通信**: 異なるコンテキスト間での安全なデータ交換

### 2. Googleフォームの内部データ構造の解析
- `FB_PUBLIC_LOAD_DATA_`: フォーム全体の設定情報
- `entry.*` input要素: 各質問への回答
- `partialResponse`: 複数ページフォームの前ページまでの回答
- `fbzx`: 回答セッションの識別子

### 3. データ永続化戦略
```typescript
// フォーム情報の保存
localForms[form.path] = form;
chrome.storage.local.set({ forms: localForms });

// 回答情報の保存
const key = getLocalAnswerKey(formId, fbzx);  // "formId-fbzx"
localAnswers[key] = formAnswers;
chrome.storage.local.set({ answers: localAnswers });
```

## 🧩 型定義の理解

### Answer型 - 回答データの種類
```typescript
export type Answer =
  | { type: "text"; value: string[]; }      // テキスト回答
  | { type: "date"; year: number; month: number; day: number; }  // 日付回答
  | { type: "time"; hour: number; minute: number; };             // 時間回答
```

この **Union型** により、異なる種類の回答を型安全に扱えます。

## 🔄 データフロー全体図

```
1. ユーザーがGoogleフォームを開く
    ↓
2. Content Script (form.ts) が実行される
    ↓
3. web-accessible-resources.js がフォーム構造を抽出
    ↓
4. postMessage でContent Scriptにデータ送信
    ↓
5. フォーム構造をChrome Storage APIで保存
    ↓
6. ユーザーが回答を入力
    ↓
7. MutationObserver が変更を検知
    ↓
8. answer.ts が回答データを抽出・保存
    ↓
9. ユーザーが拡張機能アイコンをクリック
    ↓
10. App.tsx が保存されたデータを読み込み・表示
```

## 🛡️ セキュリティ上の配慮

1. **CSP (Content Security Policy) への対応**
   - `web_accessible_resources` を使用してスクリプト注入
   
2. **Origin検証**
   ```typescript
   if (event.origin !== "https://docs.google.com") return;
   ```

3. **ローカルストレージのみ使用**
   - データは外部サーバーに送信されない
   - すべてユーザーのブラウザ内に保存

## 🎓 学習ポイント

### 初心者が学べること:
1. **Chrome拡張機能の基本構造**
2. **TypeScriptの型システム活用**
3. **Reactを使ったUIの構築**
4. **DOMの監視とイベント処理**
5. **非同期プログラミング（async/await）**
6. **データの永続化手法**

### 中級者向けの学習ポイント:
1. **セキュリティモデルの理解**
2. **ブラウザAPIの活用**
3. **リアルタイムデータ監視**
4. **複雑なデータ構造の解析**

このプロジェクトは、Webフロントエンド開発、Chrome拡張機能開発、TypeScript/React開発の実践的な学習に非常に適した題材です。
