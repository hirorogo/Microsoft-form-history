import { Answers, FormAnswers, LocalAnswers } from "@/utils/types";
import { getFormId, getLocalAnswerKey } from "@/utils/utils";

/**
 * 回答を取得して保存する
 * @returns 回答の辞書
 */
const saveAnswers = async () => {
  const answers: Answers = {};

  const addAnswer = (key: string, value: string) => {
    if (value === "") {
      return;
    }

    const id = key.split("_")[0];

    // 日時
    const isYear = key.endsWith("year");
    const isMonth = key.endsWith("month");
    const isDay = key.endsWith("day");

    if (isYear || isMonth || isDay) {
      if (!answers[id] || answers[id].type !== "date") {
        answers[id] = {
          type: "date",
          year: 0,
          month: 0,
          day: 0,
        };
      }
      if (isYear) {
        answers[id].year = parseInt(value);
      }
      if (isMonth) {
        answers[id].month = parseInt(value);
      }
      if (isDay) {
        answers[id].day = parseInt(value);
      }
      return;
    }

    // 時間
    const isHour = key.endsWith("hour");
    const isMinute = key.endsWith("minute");

    if (isHour || isMinute) {
      if (!answers[id] || answers[id].type !== "time") {
        answers[id] = {
          type: "time",
          hour: 0,
          minute: 0,
        };
      }
      if (isHour) {
        answers[id].hour = parseInt(value);
      }
      if (isMinute) {
        answers[id].minute = parseInt(value);
      }
      return;
    }

    // テキスト
    if (!answers[id]) {
      answers[id] = {
        type: "text",
        value: [],
      };
    }
    if (answers[id].type === "text") {
      answers[id].value.push(value);
    }
  };

  // 現在の回答は隠し input に個別に存在
  const inputs = document.querySelectorAll("input[type='hidden']");
  const hiddenInputKeys = new Set<string>();
  for (const input of inputs) {
    if (input instanceof HTMLInputElement) {
      if (input.name.startsWith("entry.")) {
        const key = input.name.split(".")[1];
        addAnswer(key, input.value);
        hiddenInputKeys.add(key);
      }
    }
  }

  // 前ページまでの回答は partialResponse に存在
  const input = document.querySelector("[name='partialResponse']");
  if (input instanceof HTMLInputElement) {
    try {
      const value = JSON.parse(input.value)[0];
      if (value) {
        for (const item of value) {
          const key = item[1].toString();
          // 隠し input に存在する場合，重複を防ぐために処理しない
          if (item && item.length === 4 && !hiddenInputKeys.has(key)) {
            addAnswer(key, item[2]);
          }
        }
      }
    } catch (e) {
      console.error("[google-form-history] Failed to parse partialResponse", e);
    }
  }

  // formId, fbzx を取得
  const formId = getFormId(window.location.pathname);
  let fbzx = "";
  const fbzxInput = document.querySelector("[name='fbzx']");
  if (fbzxInput instanceof HTMLInputElement) {
    fbzx = fbzxInput.value;
  }
  const key = getLocalAnswerKey(formId, fbzx);

  // 以前の回答に存在したものがあればマージ
  // ファイルアップロードは partialResponse から消えてしまうため
  const localAnswersData = (await chrome.storage.local.get("answers"))
    .answers as LocalAnswers;
  const localAnswers: LocalAnswers = localAnswersData ?? {};

  if (localAnswers[key]) {
    for (const [id, answer] of Object.entries(localAnswers[key].answers)) {
      if (!answers[id]) {
        answers[id] = answer;
      }
    }
  }

  // 回答が空の場合は保存しない
  if (Object.values(answers).length === 0) {
    return;
  }

  const formAnswers: FormAnswers = {
    formId,
    fbzx,
    date: new Date().toISOString(),
    answers,
  };

  // ローカルに保存
  localAnswers[key] = formAnswers;
  chrome.storage.local.set({ answers: localAnswers });

  console.log("[google-form-history] Answer saved", formAnswers);
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
