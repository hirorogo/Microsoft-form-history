import { Answer } from "./types";

/**
 * URLからMicrosoftフォームのIDを抽出する
 * @param url フォームのURL
 * @returns フォームID
 */
export const getFormId = (url: string): string => {
  // Microsoftフォームの一般的なURL形式
  // https://forms.office.com/Pages/ResponsePage.aspx?id=FORM_ID
  // または
  // https://forms.office.com/r/FORM_ID
  
  try {
    const urlObj = new URL(url);
    
    // パターン1: /r/FORM_ID 形式
    const rMatch = urlObj.pathname.match(/\/r\/([^/]+)/);
    if (rMatch) {
      return rMatch[1];
    }
    
    // パターン2: ResponsePage.aspx?id=FORM_ID 形式
    const idParam = urlObj.searchParams.get('id');
    if (idParam) {
      return idParam;
    }
    
    // パターン3: URLパスから最後の部分を取得
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }
    
    // フォールバック: ホスト名を含む形でユニークIDを生成
    return `unknown_${Date.now()}`;
  } catch (error) {
    console.error("[microsoft-form-history] Failed to parse form URL:", error);
    return `unknown_${Date.now()}`;
  }
};

/**
 * フォームIDと回答IDから回答データのキーを生成する
 * @param formId フォームID
 * @param submissionId 回答ID
 * @returns ローカルストレージのキー
 */
export const getLocalAnswerKey = (formId: string, submissionId: string): string => {
  return `${formId}-${submissionId}`;
};

/**
 * 回答データを文字列に変換する
 * @param answer 回答データ
 * @returns 表示用文字列
 */
export const answerToString = (answer?: Answer): string => {
  if (!answer) return "";

  switch (answer.type) {
    case "text":
      return answer.value;
    case "choice":
      return answer.value.join(", ");
    case "date":
      return `${answer.year}/${answer.month}/${answer.day}`;
    case "time":
      return `${answer.hour}:${String(answer.minute).padStart(2, '0')}`;
    case "number":
      return answer.value.toString();
    case "file":
      return answer.fileName;
    default:
      return "";
  }
};

/**
 * MicrosoftフォームのデータからフォームIDを抽出する
 * @param serverData サーバーから取得したフォームデータ
 * @returns フォームID
 */
export const extractFormIdFromServerData = (serverData: any): string => {
  // OfficeFormServerInfoからフォームIDを抽出
  try {
    if (serverData?.prefetchFormUrl) {
      const url = serverData.prefetchFormUrl;
      // URLからフォームIDを抽出
      const match = url.match(/runtimeForms\(\'([^']+)\'\)/);
      if (match) {
        return match[1];
      }
    }
    
    // フォールバック: 現在のURLから抽出
    return getFormId(window.location.href);
  } catch (error) {
    console.error("[microsoft-form-history] Failed to extract form ID from server data:", error);
    return getFormId(window.location.href);
  }
};

/**
 * 提出済みかどうかを判定する
 * @returns 提出済みの場合true
 */
export const isFormSubmitted = (): boolean => {
  // URLにthankYouが含まれている場合は提出済み
  if (window.location.href.includes('thankyou')) {
    return true;
  }
  
  // ページタイトルに「送信完了」「ありがとう」などが含まれている場合
  const title = document.title.toLowerCase();
  const submittedKeywords = [
    'thank you', 'submitted', 'complete', 'success',
    'ありがとう', '送信完了', '完了', '送信済み'
  ];
  
  return submittedKeywords.some(keyword => title.includes(keyword));
};

/**
 * ランダムな回答IDを生成する
 * @returns ユニークな回答ID
 */
export const generateSubmissionId = (): string => {
  return `submission_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * フォーム要素から回答データを抽出する
 * @param element フォーム要素
 * @returns 抽出した回答データ
 */
export const extractAnswerFromElement = (element: HTMLElement): { id: string; value: any } | null => {
  try {
    // input要素の場合
    if (element instanceof HTMLInputElement) {
      const name = element.name || element.id;
      if (!name) return null;
      
      if (element.type === 'text' || element.type === 'email' || element.type === 'number') {
        return { id: name, value: element.value };
      }
      
      if (element.type === 'checkbox' || element.type === 'radio') {
        return { id: name, value: element.checked ? element.value : null };
      }
      
      if (element.type === 'date') {
        const date = new Date(element.value);
        return {
          id: name,
          value: {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
          }
        };
      }
      
      if (element.type === 'time') {
        const [hour, minute] = element.value.split(':').map(Number);
        return {
          id: name,
          value: { hour: hour || 0, minute: minute || 0 }
        };
      }
    }
    
    // textarea要素の場合
    if (element instanceof HTMLTextAreaElement) {
      const name = element.name || element.id;
      if (!name) return null;
      return { id: name, value: element.value };
    }
    
    // select要素の場合
    if (element instanceof HTMLSelectElement) {
      const name = element.name || element.id;
      if (!name) return null;
      
      if (element.multiple) {
        const values = Array.from(element.selectedOptions).map(option => option.value);
        return { id: name, value: values };
      } else {
        return { id: name, value: element.value };
      }
    }
    
    return null;
  } catch (error) {
    console.error("[microsoft-form-history] Failed to extract answer from element:", error);
    return null;
  }
};
