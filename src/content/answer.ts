import { Answers, FormAnswers, LocalAnswers, Answer } from "@/utils/types";
import { getFormId, getLocalAnswerKey, generateSubmissionId, extractAnswerFromElement, isFormSubmitted } from "@/utils/utils";

let currentSubmissionId = generateSubmissionId();
let isSubmitted = false;

/**
 * Microsoftフォームの回答を監視・保存する
 */
const saveAnswers = async () => {
  try {
    const answers: Answers = {};
    const formId = getFormId(window.location.href);

    // 提出済みかチェック
    isSubmitted = isFormSubmitted();

    // フォーム内の全ての入力要素を取得
    const inputElements = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="number"], input[type="date"], input[type="time"], ' +
      'input[type="radio"], input[type="checkbox"], ' +
      'textarea, select'
    );

    // 各入力要素から回答データを抽出
    inputElements.forEach((element) => {
      const answerData = extractAnswerFromElement(element as HTMLElement);
      if (answerData && answerData.value !== null && answerData.value !== '') {
        
        // 回答データの型を判定して適切な形式で保存
        const answer: Answer | null = createAnswerFromValue(element, answerData.value);
        if (answer) {
          answers[answerData.id] = answer;
        }
      }
    });

    // 回答が空の場合は保存しない
    if (Object.keys(answers).length === 0) {
      return;
    }

    // 回答データを作成
    const formAnswers: FormAnswers = {
      formId,
      submissionId: currentSubmissionId,
      date: new Date().toISOString(),
      answers,
      isSubmitted
    };

    // ローカルストレージに保存
    const key = getLocalAnswerKey(formId, currentSubmissionId);
    const localAnswersData = (await chrome.storage.local.get("answers")).answers as LocalAnswers;
    const localAnswers: LocalAnswers = localAnswersData || {};
    
    localAnswers[key] = formAnswers;
    await chrome.storage.local.set({ answers: localAnswers });

    console.log("[microsoft-form-history] Answers saved:", formAnswers);

    // AI回答提案機能（仕様書の要件）
    await generateAISuggestions(answers);

  } catch (error) {
    console.error("[microsoft-form-history] Failed to save answers:", error);
  }
};

/**
 * 入力要素と値からAnswer型のオブジェクトを生成する
 * @param element HTML要素
 * @param value 値
 * @returns Answer型のオブジェクト
 */
function createAnswerFromValue(element: Element, value: any): Answer | null {
  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case "text":
      case "email":
        return { type: "text", value: String(value) };
      
      case "number":
        return { type: "number", value: Number(value) || 0 };
      
      case "date":
        const date = new Date(value);
        return {
          type: "date",
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        };
      
      case "time":
        const [hour, minute] = String(value).split(':').map(Number);
        return { type: "time", hour: hour || 0, minute: minute || 0 };
      
      case "radio":
        return { type: "choice", value: element.checked ? [String(value)] : [] };
      
      case "checkbox":
        // チェックボックスは複数選択の可能性があるため特別処理
        const currentAnswer = element.checked ? [String(value)] : [];
        return { type: "choice", value: currentAnswer };
      
      case "file":
        return { type: "file", fileName: String(value) };
      
      default:
        return { type: "text", value: String(value) };
    }
  }
  
  if (element instanceof HTMLTextAreaElement) {
    return { type: "text", value: String(value) };
  }
  
  if (element instanceof HTMLSelectElement) {
    if (element.multiple) {
      const values = Array.from(element.selectedOptions).map(option => option.value);
      return { type: "choice", value: values };
    } else {
      return { type: "choice", value: [String(value)] };
    }
  }

  return null;
}

/**
 * AI回答提案機能（仕様書の要件：自由入力欄でAIを使用し文章を考える）
 * @param _answers 現在の回答データ（将来の拡張用）
 */
async function generateAISuggestions(_answers: Answers) {
  try {
    // 自由入力欄（テキストエリア）の要素を取得
    const textInputs = document.querySelectorAll('textarea, input[type="text"]');
    
    textInputs.forEach(async (input) => {
      const element = input as HTMLTextAreaElement | HTMLInputElement;
      
      // 空の場合のみAI提案を表示
      if (!element.value.trim()) {
        await showAISuggestion(element);
      }
    });
  } catch (error) {
    console.error("[microsoft-form-history] Failed to generate AI suggestions:", error);
  }
}

/**
 * AI回答提案UIを表示する
 * @param element 入力要素
 */
async function showAISuggestion(element: HTMLTextAreaElement | HTMLInputElement) {
  try {
    // 質問文を取得
    const questionElement = element.closest('[data-automation-id*="question"]') ||
                           element.closest('.office-form-question-element') ||
                           element.closest('div[role="group"]');
    
    let questionText = "";
    if (questionElement) {
      const titleElement = questionElement.querySelector('h2, label, .ms-fontSize-18');
      questionText = titleElement?.textContent?.trim() || "";
    }

    // AI提案ボタンが既に存在する場合は作成しない
    if (element.parentElement?.querySelector('.ai-suggestion-btn')) {
      return;
    }

    // AI提案ボタンを作成
    const suggestionBtn = document.createElement('button');
    suggestionBtn.textContent = 'AI回答提案';
    suggestionBtn.className = 'ai-suggestion-btn';
    suggestionBtn.style.cssText = `
      margin: 5px 0;
      padding: 5px 10px;
      background: #0078d4;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;

    // クリックイベントを追加
    suggestionBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      suggestionBtn.textContent = '生成中...';
      suggestionBtn.disabled = true;

      try {
        // AI提案を生成（シンプルな例）
        const suggestions = generateSimpleAISuggestions(questionText);
        showSuggestionMenu(element, suggestions);
      } catch (error) {
        console.error("Failed to generate AI suggestion:", error);
        alert("AI提案の生成に失敗しました");
      } finally {
        suggestionBtn.textContent = 'AI回答提案';
        suggestionBtn.disabled = false;
      }
    });

    // ボタンを挿入
    element.parentElement?.insertBefore(suggestionBtn, element.nextSibling);

  } catch (error) {
    console.error("[microsoft-form-history] Failed to show AI suggestion:", error);
  }
}

/**
 * シンプルなAI提案を生成する（本来はAPIを使用）
 * @param questionText 質問文
 * @returns 提案文の配列
 */
function generateSimpleAISuggestions(questionText: string): string[] {
  // 簡易的な提案生成（本来はOpenAI APIなどを使用）
  const suggestions = [];
  
  if (questionText.includes('感想') || questionText.includes('意見')) {
    suggestions.push("大変勉強になりました。");
    suggestions.push("今後も継続的に学習していきたいと思います。");
    suggestions.push("貴重な機会をいただき、ありがとうございました。");
  } else if (questionText.includes('改善') || questionText.includes('要望')) {
    suggestions.push("より詳細な説明があると助かります。");
    suggestions.push("実践的な例をもっと増やしていただけると嬉しいです。");
    suggestions.push("質問時間をもう少し長くしていただきたいです。");
  } else {
    suggestions.push("特にございません。");
    suggestions.push("満足しています。");
    suggestions.push("ありがとうございました。");
  }
  
  return suggestions;
}

/**
 * AI提案メニューを表示する
 * @param element 入力要素
 * @param suggestions 提案文の配列
 */
function showSuggestionMenu(element: HTMLTextAreaElement | HTMLInputElement, suggestions: string[]) {
  // 既存のメニューを削除
  document.querySelectorAll('.ai-suggestion-menu').forEach(menu => menu.remove());

  const menu = document.createElement('div');
  menu.className = 'ai-suggestion-menu';
  menu.style.cssText = `
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
    max-width: 300px;
    padding: 5px;
  `;

  suggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.textContent = suggestion;
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    `;
    
    item.addEventListener('click', () => {
      element.value = suggestion;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      menu.remove();
    });
    
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f5f5f5';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = '';
    });

    menu.appendChild(item);
  });

  // 閉じるボタン
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '✖ 閉じる';
  closeBtn.style.cssText = `
    padding: 5px;
    text-align: center;
    background: #f0f0f0;
    cursor: pointer;
    border-top: 1px solid #ccc;
  `;
  closeBtn.addEventListener('click', () => menu.remove());
  menu.appendChild(closeBtn);

  // 要素の近くに配置
  const rect = element.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(menu);

  // 外側クリックで閉じる
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 100);
}

/**
 * フォーム送信の監視
 */
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    event.data?.source !== "microsoft-form-history"
  ) {
    return;
  }

  const { type } = event.data;

  if (type === "FORM_SUBMITTING") {
    // 送信前の最終保存
    await saveAnswers();
  } else if (type === "FORM_SUBMITTED") {
    // 送信完了時
    isSubmitted = true;
    await saveAnswers();
  }
});

// フォームの変更を監視
const observer = new MutationObserver(async () => {
  await saveAnswers();
});

// フォームが見つかったら監視開始
const startObserving = () => {
  const form = document.querySelector("form") || document.body;
  if (form) {
    observer.observe(form, {
      subtree: true,
      attributes: true,
      childList: true,
    });
    
    // 初回保存
    saveAnswers();
    return true;
  }
  return false;
};

// ページ読み込み完了時に監視開始
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startObserving, 1000);
  });
} else {
  setTimeout(startObserving, 1000);
}

// 入力要素のフォーカス時にAI提案ボタンを追加
document.addEventListener('focus', async (event) => {
  const element = event.target;
  if (element instanceof HTMLTextAreaElement || 
      (element instanceof HTMLInputElement && element.type === 'text')) {
    await showAISuggestion(element);
  }
}, true);
