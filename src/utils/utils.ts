import { Answer } from "./types";

export const getFormId = (path: string) => {
  const splits = path.split("/");
  return splits.find((item) => item.length > 10) ?? "";
};

export const answerToString = (answer: Answer) => {
  switch (answer.type) {
    case "text":
      return answer.value.join("，");
    case "date":
      const month = answer.month.toString().padStart(2, "0");
      const day = answer.day.toString().padStart(2, "0");
      return `${answer.year}/${month}/${day}`;
    case "time":
      const hour = answer.hour.toString().padStart(2, "0");
      const minute = answer.minute.toString().padStart(2, "0");
      return `${hour}:${minute}`;
  }
};

export const getLocalAnswerKey = (formId: string, fbzx: string) => {
  return `${formId}:${fbzx}`;
};
