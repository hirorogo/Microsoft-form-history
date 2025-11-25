import {
  Form,
  QuestionType,
  LocalForms,
  MicrosoftFormData
} from "@/utils/types";
import { getFormId, extractFormIdFromServerData } from "@/utils/utils";

// Web Accessible Resourcesを注入
(() => {
  const script = document.createElement("script");
  const filePath = chrome.runtime.getURL("src/web-accessible-resources.js");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", filePath);
  document.head.appendChild(script);
})();

// Microsoftフォームの情報を処理する
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    event.data?.source !== "microsoft-form-history"
  ) {
    return;
  }

  try {
    const { type, payload } = event.data;

    if (type === "SERVER_INFO") {
      await processServerInfo(payload);
    } else if (type === "FORM_LOADED") {
      await processFormLoaded();
    }
  } catch (error) {
    console.error("[microsoft-form-history] Failed to process form data:", error);
  }
});

/**
 * サーバー情報を処理してフォーム構造を保存する
 * @param serverInfo OfficeFormServerInfoのデータ
 */
async function processServerInfo(serverInfo: any) {
  console.log("[microsoft-form-history] Processing server info:", serverInfo);

  // フォームIDを抽出
  const formId = extractFormIdFromServerData(serverInfo);
  
  // フォーム情報をAPIから取得を試行
  let formData: MicrosoftFormData | null = null;
  
  if (serverInfo.prefetchFormUrl) {
    try {
      formData = await fetchFormData(serverInfo.prefetchFormUrl);
    } catch (error) {
      console.warn("[microsoft-form-history] Failed to fetch form data from API:", error);
    }
  }
  
  // APIから取得できない場合はDOMから抽出
  if (!formData) {
    formData = extractFormFromDOM(formId);
  }

  if (formData) {
    await saveFormData(formData);
  }
}

/**
 * フォームが読み込まれた時の処理
 */
async function processFormLoaded() {
  console.log("[microsoft-form-history] Form loaded, extracting structure from DOM");
  
  // DOMからフォーム構造を抽出
  const formId = getFormId(window.location.href);
  const formData = extractFormFromDOM(formId);
  
  if (formData) {
    await saveFormData(formData);
  }
}

/**
 * APIからフォームデータを取得する
 * @param apiUrl APIのURL
 * @returns フォームデータ
 */
async function fetchFormData(apiUrl: string): Promise<MicrosoftFormData | null> {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return parseApiFormData(data);
  } catch (error) {
    console.error("[microsoft-form-history] Failed to fetch form data:", error);
    return null;
  }
}

/**
 * APIレスポンスをMicrosoftFormData形式に変換する
 * @param apiData APIから取得したデータ
 * @returns 変換されたフォームデータ
 */
function parseApiFormData(apiData: any): MicrosoftFormData | null {
  try {
    // APIレスポンスの構造に応じて変換
    const formData: MicrosoftFormData = {
      id: apiData.id || getFormId(window.location.href),
      title: apiData.title || apiData.displayName || "無題のフォーム",
      description: apiData.description || apiData.subtitle,
      questions: (apiData.questions || []).map((q: any) => ({
        id: q.id,
        title: q.title || q.displayName,
        subtitle: q.subtitle || q.description,
        required: q.required || false,
        type: mapQuestionType(q.type),
        choices: q.choices?.map((c: any) => c.displayName || c.value) || []
      }))
    };

    return formData;
  } catch (error) {
    console.error("[microsoft-form-history] Failed to parse API form data:", error);
    return null;
  }
}

/**
 * DOMからフォーム構造を抽出する
 * @param formId フォームID
 * @returns フォームデータ
 */
function extractFormFromDOM(formId: string): MicrosoftFormData | null {
  try {
    // フォームタイトルを取得
    let title = "無題のフォーム";
    const titleElement = document.querySelector('h1') || 
                        document.querySelector('[data-automation-id="formTitle"]') ||
                        document.querySelector('.ms-fontSize-32') ||
                        document.querySelector('div[role="heading"]');
    
    if (titleElement) {
      title = titleElement.textContent?.trim() || title;
    }

    // フォームの説明を取得
    let description = "";
    const descElement = document.querySelector('[data-automation-id="formDescription"]') ||
                       document.querySelector('.ms-fontSize-16');
    
    if (descElement) {
      description = descElement.textContent?.trim() || "";
    }

    // 質問要素を取得
    const questions: any[] = [];
    const questionElements = document.querySelectorAll('[data-automation-id*="question"]') ||
                            document.querySelectorAll('.office-form-question-element') ||
                            document.querySelectorAll('div[role="group"]');

    questionElements.forEach((questionEl, index) => {
      const questionData = extractQuestionFromElement(questionEl as HTMLElement, index);
      if (questionData) {
        questions.push(questionData);
      }
    });

    return {
      id: formId,
      title,
      description,
      questions
    };
  } catch (error) {
    console.error("[microsoft-form-history] Failed to extract form from DOM:", error);
    return null;
  }
}

/**
 * 質問要素から質問データを抽出する
 * @param element 質問要素
 * @param index インデックス
 * @returns 質問データ
 */
function extractQuestionFromElement(element: HTMLElement, index: number): any | null {
  try {
    // 質問ID（data属性やクラス名から推測）
    const id = element.getAttribute('data-automation-id') ||
              element.getAttribute('data-question-id') ||
              element.id ||
              `question_${index}`;

    // 質問タイトル
    let title = "質問";
    const titleEl = element.querySelector('h2') ||
                   element.querySelector('[data-automation-id*="title"]') ||
                   element.querySelector('.ms-fontSize-18') ||
                   element.querySelector('label');
    
    if (titleEl) {
      title = titleEl.textContent?.trim() || title;
    }

    // 質問タイプを推定
    let type: QuestionType = "text";
    const inputElements = element.querySelectorAll('input, textarea, select');
    
    if (inputElements.length > 0) {
      const firstInput = inputElements[0] as HTMLInputElement;
      type = mapInputTypeToQuestionType(firstInput);
    }

    // 選択肢がある場合は取得
    let choices: string[] = [];
    if (type === "choice" || type === "multichoice" || type === "dropdown") {
      const choiceElements = element.querySelectorAll('label, option');
      choices = Array.from(choiceElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0) as string[];
    }

    // 必須かどうか
    const required = element.querySelector('.required') !== null ||
                    element.querySelector('[aria-required="true"]') !== null ||
                    title.includes('*');

    return {
      id,
      title,
      subtitle: "",
      required,
      type,
      choices
    };
  } catch (error) {
    console.error("[microsoft-form-history] Failed to extract question:", error);
    return null;
  }
}

/**
 * APIの質問タイプをQuestionTypeにマップする
 * @param apiType API質問タイプ
 * @returns QuestionType
 */
function mapQuestionType(apiType: string): QuestionType {
  const typeMap: Record<string, QuestionType> = {
    "text": "text",
    "paragraph": "paragraph",
    "singleSelect": "choice",
    "multiSelect": "multichoice",
    "dropdown": "dropdown",
    "date": "date",
    "time": "time",
    "number": "number",
    "email": "email",
    "fileUpload": "file"
  };

  return typeMap[apiType] || "text";
}

/**
 * HTML入力タイプをQuestionTypeにマップする
 * @param input HTML入力要素
 * @returns QuestionType
 */
function mapInputTypeToQuestionType(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): QuestionType {
  if (input instanceof HTMLTextAreaElement) {
    return "paragraph";
  }
  
  if (input instanceof HTMLSelectElement) {
    return input.multiple ? "multichoice" : "dropdown";
  }
  
  if (input instanceof HTMLInputElement) {
    switch (input.type) {
      case "text":
        return "text";
      case "email":
        return "email";
      case "number":
        return "number";
      case "date":
        return "date";
      case "time":
        return "time";
      case "radio":
        return "choice";
      case "checkbox":
        return "multichoice";
      case "file":
        return "file";
      default:
        return "text";
    }
  }

  return "text";
}

/**
 * フォームデータをローカルストレージに保存する
 * @param formData フォームデータ
 */
async function saveFormData(formData: MicrosoftFormData) {
  try {
    // Form型に変換
    const form: Form = {
      id: formData.id,
      title: formData.title,
      description: formData.description,
      items: formData.questions.map(q => ({
        id: q.id,
        title: q.title,
        subtitle: q.subtitle,
        required: q.required,
        type: q.type,
        choices: q.choices
      }))
    };

    // ローカルストレージから既存データを取得
    const localFormsData = (await chrome.storage.local.get("forms")).forms as LocalForms;
    const localForms: LocalForms = localFormsData || {};
    
    // フォームデータを保存
    localForms[form.id] = form;
    await chrome.storage.local.set({ forms: localForms });
    
    console.log("[microsoft-form-history] Form structure saved:", form);
  } catch (error) {
    console.error("[microsoft-form-history] Failed to save form data:", error);
  }
}
