// formId をキーにしたフォームデータ
export type LocalForms = Record<string, Form>;

export interface Form {
  title: string;
  path: string;
  items: Item[];
}

export interface Item {
  id: string;
  headline: string;
  label: string;
  questions: Question[];
}

export interface Question {
  answerId: number;
  options: string[];
}

// $formId-$fbzx をキーにした回答データ
export type LocalAnswers = Record<string, FormAnswers>;

export interface FormAnswers {
  formId: string;
  fbzx: string;
  date: string;
  answers: Answers;
}

// answerId をキーにした回答データ
export type Answers = Record<string, Answer>;

export type Answer =
  | {
      type: "text";
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
    };
