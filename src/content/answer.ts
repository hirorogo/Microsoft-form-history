import { FormAnswers, LocalAnswers } from "@/utils/types";
import { getFormId } from "@/utils/utils";

/**
 * 回答を取得して保存する
 * @returns 回答の辞書
 */
const saveAnswers = async () => {
  const answers: Record<string, string[]> = {};

  const addAnswer = (id: string, value: string) => {
    if (!answers[id]) {
      answers[id] = [];
    }
    answers[id].push(value);
  };

  // 現在の回答は隠し input に個別に存在
  const inputs = document.querySelectorAll("input[type='hidden']");
  const hiddenInputIds = new Set<string>();
  for (const input of inputs) {
    if (input instanceof HTMLInputElement) {
      if (input.name.startsWith("entry.")) {
        const id = input.name.split(".")[1];
        addAnswer(id, input.value);
        hiddenInputIds.add(id);
      }
    }
  }

  // 前ページまでの回答は partialResponse に存在
  const input = document.querySelector("[name='partialResponse']");
  if (input instanceof HTMLInputElement) {
    const value = JSON.parse(input.value)[0];
    if (value) {
      for (const item of value) {
        const id = item[1];
        // 隠し input に存在する場合，重複を防ぐために処理しない
        if (item && item.length === 4 && !hiddenInputIds.has(id)) {
          addAnswer(id, item[2]);
        }
      }
    }
  }

  const formId = getFormId(window.location.pathname);

  // fbzx を取得
  let fbzx = "";
  const fbzxInput = document.querySelector("[name='fbzx']");
  if (fbzxInput instanceof HTMLInputElement) {
    fbzx = fbzxInput.value;
  }

  const formAnswers: FormAnswers = {
    formId,
    fbzx,
    date: new Date().toISOString(),
    answers,
  };

  // ローカルに保存
  const localAnswersData = (await chrome.storage.local.get("answers"))
    .answers as LocalAnswers;
  const localAnswers: LocalAnswers = localAnswersData ?? {};
  const key = `${formId}:${fbzx}`;
  localAnswers[key] = formAnswers;
  chrome.storage.local.set({ answers: localAnswers });

  console.log("[google-form-save] Answer saved", formAnswers);
};

// 回答を記録
const observer = new MutationObserver(() => {
  saveAnswers();
});
const form = document.querySelector("form");
if (form) {
  observer.observe(form, {
    subtree: true,
    attributes: true,
  });
}
saveAnswers();
