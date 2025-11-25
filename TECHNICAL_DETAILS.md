# 技術的詳細解説 - コード例とベストプラクティス

## 📋 プロジェクト解析の補足

このファイルでは、より技術的な詳細とコード例を示します。

## 🔧 開発環境のセットアップ

### 必要な依存関係
```json
{
  "dependencies": {
    "react": "^19.1.0",           // UIライブラリ
    "react-dom": "^19.1.0"        // React DOM操作
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.3",      // Chrome拡張機能用Viteプラグイン
    "@types/chrome": "^0.1.1",           // Chrome API型定義
    "@vitejs/plugin-react": "^4.7.0",    // React用Viteプラグイン
    "typescript": "~5.8.3",              // TypeScript
    "vite": "^7.0.5"                     // ビルドツール
  }
}
```

### ビルドコマンド
```bash
npm run dev     # 開発モード
npm run build   # 本番ビルド
npm run preview # プレビュー
```

## 🎯 Chrome拡張機能の高度な仕組み

### 1. Manifest V3 の特徴
```typescript
// manifest.config.ts
export default defineManifest({
  manifest_version: 3,  // 最新版（V2は廃止予定）
  
  // セキュリティが強化されたポイント:
  // - eval() の使用禁止
  // - インラインスクリプトの制限
  // - CSP (Content Security Policy) の厳格化
  
  permissions: ["storage"],  // 最小権限の原則
  
  // Host permissions（V3の新機能）
  host_permissions: ["https://docs.google.com/*"]
});
```

### 2. Content Scripts vs Web Accessible Resources

#### Content Script（制限されたコンテキスト）
```typescript
// src/content/main.ts
// ✅ できること:
// - DOM の読み書き
// - Chrome APIs の使用
// - メッセージパッシング

// ❌ できないこと:
// - window オブジェクトへの直接アクセス
// - ページのグローバル変数へのアクセス
// - eval() の実行
```

#### Web Accessible Resources（ページコンテキスト）
```javascript
// src/web-accessible-resources.js
// ✅ できること:
// - window オブジェクトへのフルアクセス
// - ページのグローバル変数へのアクセス
// - ページの関数呼び出し

// ❌ できないこと:
// - Chrome APIs の使用
// - 拡張機能のファイルへの直接アクセス
```

## 📊 Googleフォームの内部データ構造解析

### FB_PUBLIC_LOAD_DATA_ の実際の構造
```typescript
// 実際のデータ例（簡略化）
const FB_PUBLIC_LOAD_DATA_ = [
  null,
  [
    null,
    [
      // 各質問項目
      [
        "123456789",           // 質問ID
        "お名前",              // 質問のヘッドライン
        "名前を入力してください", // 質問の説明
        null,
        [
          [
            987654321,         // Answer ID
            [["テキスト入力"]]  // 選択肢（テキストの場合は空）
          ]
        ]
      ]
    ]
  ],
  null,
  "アンケートフォーム",        // フォームタイトル
  // ... 他の設定項目
  null, null, null, null, null, null, null, null, null,
  "1FAIpQLSe...",             // フォームID（インデックス14）
];
```

### 回答データの抽出パターン

#### パターン1: 隠しInput要素
```html
<!-- 現在ページの回答 -->
<input type="hidden" name="entry.123456789" value="山田太郎">
<input type="hidden" name="entry.987654321_year" value="2024">
<input type="hidden" name="entry.987654321_month" value="3">
<input type="hidden" name="entry.987654321_day" value="15">
```

#### パターン2: partialResponse
```html
<!-- 複数ページフォームの前ページまでの回答 -->
<input type="hidden" name="partialResponse" value='[
  [
    [null, "123456789", "山田太郎", 0],
    [null, "987654321", ["選択肢1", "選択肢2"], 0]
  ]
]'>
```

## 🧠 高度なTypeScript活用技法

### 1. Union Types による型安全性
```typescript
// src/utils/types.ts
export type Answer =
  | { type: "text"; value: string[]; }
  | { type: "date"; year: number; month: number; day: number; }
  | { type: "time"; hour: number; minute: number; };

// 使用例
const processAnswer = (answer: Answer) => {
  switch (answer.type) {
    case "text":
      return answer.value.join(", ");  // TypeScriptが value: string[] を推論
    case "date":
      return `${answer.year}/${answer.month}/${answer.day}`;  // 日付フィールドを推論
    case "time":
      return `${answer.hour}:${answer.minute}`;  // 時間フィールドを推論
  }
};
```

### 2. Generic Types による再利用性
```typescript
// ローカルストレージの型安全なラッパー
type StorageKey = "forms" | "answers";
type StorageData = {
  forms: LocalForms;
  answers: LocalAnswers;
};

const getStorageData = async <K extends StorageKey>(
  key: K
): Promise<StorageData[K] | undefined> => {
  const result = await chrome.storage.local.get(key);
  return result[key] as StorageData[K];
};

// 使用例
const forms = await getStorageData("forms");  // 型: LocalForms | undefined
const answers = await getStorageData("answers");  // 型: LocalAnswers | undefined
```

## 🔄 リアルタイムデータ監視の実装詳細

### MutationObserver の最適化
```typescript
// src/content/answer.ts
let saveTimeout: NodeJS.Timeout | null = null;

const debouncedSaveAnswers = () => {
  // デバウンス処理で過度な保存を防止
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(() => {
    saveAnswers();
    saveTimeout = null;
  }, 500);  // 500ms後に実行
};

const observer = new MutationObserver((mutations) => {
  // 関連する変更のみを処理
  const relevantChange = mutations.some(mutation => {
    const target = mutation.target as Element;
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      (target.hasAttribute && target.hasAttribute("name"))
    );
  });
  
  if (relevantChange) {
    debouncedSaveAnswers();
  }
});
```

### 非同期処理のエラーハンドリング
```typescript
const saveAnswers = async () => {
  try {
    const answers = await extractAnswers();
    
    if (Object.keys(answers).length === 0) {
      console.log("[google-form-history] No answers to save");
      return;
    }
    
    await saveToStorage(answers);
    console.log("[google-form-history] Answers saved successfully");
    
  } catch (error) {
    console.error("[google-form-history] Failed to save answers:", error);
    
    // エラー通知（オプション）
    if (process.env.NODE_ENV === "development") {
      chrome.notifications?.create({
        type: "basic",
        iconUrl: "logo.png",
        title: "Google Form History",
        message: "Failed to save answers"
      });
    }
  }
};
```

## 🎨 React UIの最適化テクニック

### 1. Custom Hooks による状態管理
```typescript
// src/popup/hooks/useFormHistory.ts
const useFormHistory = () => {
  const [displayAnswers, setDisplayAnswers] = useState<DisplayAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [formsData, answersData] = await Promise.all([
        getStorageData("forms"),
        getStorageData("answers")
      ]);
      
      const processedData = processFormHistory(formsData, answersData);
      setDisplayAnswers(processedData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAnswer = useCallback(async (formId: string, fbzx: string) => {
    try {
      await deleteAnswerFromStorage(formId, fbzx);
      setDisplayAnswers(prev => 
        prev.filter(answer => 
          !(answer.formId === formId && answer.fbzx === fbzx)
        )
      );
    } catch (err) {
      setError("Failed to delete answer");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    displayAnswers,
    loading,
    error,
    deleteAnswer,
    refreshData: loadData
  };
};
```

### 2. メモ化による性能最適化
```typescript
// src/popup/components/AnswerItem.tsx
const AnswerItem = React.memo<{
  answer: DisplayAnswer;
  onDelete: (formId: string, fbzx: string) => void;
}>(({ answer, onDelete }) => {
  const handleDelete = useCallback(() => {
    onDelete(answer.formId, answer.fbzx);
  }, [answer.formId, answer.fbzx, onDelete]);

  return (
    <div className="answer-item">
      <h3>{answer.title}</h3>
      <p>{formatDate(answer.date)}</p>
      {answer.items.map((item, index) => (
        <AnswerDetail 
          key={`${item.headline}-${index}`}
          item={item}
        />
      ))}
      <button onClick={handleDelete}>削除</button>
    </div>
  );
});
```

## 🔐 セキュリティとプライバシーの考慮

### 1. データサニタイゼーション
```typescript
const sanitizeUserInput = (input: string): string => {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

const answerToString = (answer?: Answer): string => {
  if (!answer) return "";
  
  switch (answer.type) {
    case "text":
      return answer.value.map(sanitizeUserInput).join(", ");
    case "date":
      return `${answer.year}/${answer.month}/${answer.day}`;
    case "time":
      return `${answer.hour}:${answer.minute}`;
    default:
      return "";
  }
};
```

### 2. 安全な通信の実装
```typescript
// セキュアなPostMessage通信
const sendSecureMessage = (data: any, targetOrigin: string) => {
  // オリジンの検証
  if (!targetOrigin.startsWith("https://docs.google.com")) {
    throw new Error("Invalid target origin");
  }
  
  // データの検証
  if (typeof data !== "object" || !data.source) {
    throw new Error("Invalid message format");
  }
  
  window.postMessage(data, targetOrigin);
};

// メッセージ受信時の検証
window.addEventListener("message", (event) => {
  // Origin検証
  if (event.origin !== "https://docs.google.com") {
    return;
  }
  
  // Source検証
  if (event.source !== window) {
    return;
  }
  
  // データ構造検証
  if (!event.data?.source || event.data.source !== "google-form-history") {
    return;
  }
  
  // 処理を実行
  processMessage(event.data);
});
```

## 🚀 パフォーマンス最適化

### 1. バンドルサイズの最適化
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          utils: ["./src/utils/types", "./src/utils/utils"]
        }
      }
    }
  },
  
  // Tree shaking の最適化
  plugins: [
    react(),
    crx({ manifest }),
    // バンドルアナライザー（開発時）
    process.env.ANALYZE && bundleAnalyzer()
  ].filter(Boolean)
});
```

### 2. メモリリーク防止
```typescript
// src/content/answer.ts
class AnswerMonitor {
  private observer: MutationObserver | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  start() {
    this.observer = new MutationObserver(this.handleMutation.bind(this));
    const form = document.querySelector("form");
    
    if (form) {
      this.observer.observe(form, {
        subtree: true,
        attributes: true
      });
    }
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  private handleMutation = () => {
    // デバウンス処理
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveAnswers();
    }, 500);
  };
}

// ページアンロード時のクリーンアップ
const monitor = new AnswerMonitor();
monitor.start();

window.addEventListener("beforeunload", () => {
  monitor.stop();
});
```

## 📈 デバッグとロギング

### 開発用デバッグヘルパー
```typescript
// src/utils/debug.ts
const DEBUG = process.env.NODE_ENV === "development";

export const logger = {
  debug: (message: string, data?: any) => {
    if (DEBUG) {
      console.log(`[google-form-history:DEBUG] ${message}`, data);
    }
  },
  
  info: (message: string, data?: any) => {
    console.log(`[google-form-history:INFO] ${message}`, data);
  },
  
  error: (message: string, error?: any) => {
    console.error(`[google-form-history:ERROR] ${message}`, error);
  },
  
  performance: (label: string, fn: () => void) => {
    if (DEBUG) {
      console.time(`[google-form-history:PERF] ${label}`);
      fn();
      console.timeEnd(`[google-form-history:PERF] ${label}`);
    } else {
      fn();
    }
  }
};

// 使用例
logger.debug("Form data received", formData);
logger.performance("Answer processing", () => {
  processAnswers();
});
```

この技術的詳細解説により、プロジェクトのより深い理解と実装の背景にある設計思想を学ぶことができます。
