// formId をキーにしたフォームデータ
export type LocalForms = Record<string, Form>;

export interface Form {
  title: string;
  path: string;
  items: Item[];
}

export interface Item {
  id: string;
  answerId?: string;
  headline: string;
  label: string;
  options: string[];
}

// $formId-$fbzx をキーにした回答データ
export type LocalAnswers = Record<string, FormAnswers>;

// answerId をキーにした回答データ
export type FormAnswers = Record<string, string[]>;
