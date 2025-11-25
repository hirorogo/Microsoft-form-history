// Microsoftフォームのデータ構造
export interface MicrosoftFormData {
  id: string;
  title: string;
  description?: string;
  questions: MicrosoftFormQuestion[];
  settings?: any;
}

export interface MicrosoftFormQuestion {
  id: string;
  title: string;
  subtitle?: string;
  required: boolean;
  type: QuestionType;
  choices?: string[];
  validations?: any;
}

export type QuestionType = 
  | "text" 
  | "paragraph" 
  | "choice" 
  | "multichoice" 
  | "dropdown"
  | "date"
  | "time"
  | "number"
  | "email"
  | "file";

// フォームIDをキーにしたフォームデータ
export type LocalForms = Record<string, Form>;

export interface Form {
  title: string;
  id: string;
  description?: string;
  items: Item[];
  submissionId?: string;
}

export interface Item {
  id: string;
  title: string;
  subtitle?: string;
  required: boolean;
  type: QuestionType;
  choices?: string[];
}

// フォームID-回答IDをキーにした回答データ
export type LocalAnswers = Record<string, FormAnswers>;

export interface FormAnswers {
  formId: string;
  submissionId: string;
  date: string;
  answers: Answers;
  isSubmitted: boolean;
}

// 質問IDをキーにした回答データ
export type Answers = Record<string, Answer>;

export type Answer =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "choice";
      value: string[];
    }
  | {
      type: "date";
      year: number;
      month: number;
      day: number;
    }
  | {
      type: "time";
      hour: number;
      minute: number;
    }
  | {
      type: "number";
      value: number;
    }
  | {
      type: "file";
      fileName: string;
    };

// AI支援用の回答提案
export interface AnswerSuggestion {
  questionId: string;
  suggestions: string[];
  context?: string;
}
