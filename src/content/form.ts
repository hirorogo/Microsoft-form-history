import { Form, Item } from "@/utils/types";
import { getFormId } from "@/utils/utils";

// FB_PUBLIC_LOAD_DATA_ を取得するためにスクリプトを注入
(() => {
  const script = document.createElement("script");
  const filePath = chrome.runtime.getURL("src/web-accessible-resources.js");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", filePath);
  document.body.appendChild(script);
})();

// web-accessible-resources.js からデータを取得
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== "https://docs.google.com" ||
    event.data?.source !== "google-form-history"
  ) {
    return;
  }
  const data = event.data.payload;

  const items = data[1][1].map((item: any) => {
    const tempItem: Item = {
      id: item[0],
      headline: item[1],
      label: item[2],
      options: [],
    };
    // TODO: グリッドに対応
    const detail = item[4]?.[0];
    if (detail) {
      if (detail[0]) {
        tempItem.answerId = detail[0];
      }
      if (detail[1]) {
        tempItem.options = detail[1].map((option: any) => option[0]);
      }
    }
    return tempItem;
  });

  const form: Form = {
    title: data[3],
    path: getFormId(data[14]),
    items,
  };

  // ローカルに保存
  const localFormsData = (await chrome.storage.local.get("forms")).forms as any;
  const localForms: Record<string, Form> = localFormsData ?? {};
  localForms[form.path] = form;
  chrome.storage.local.set({ forms: localForms });
  console.log("[google-form-history] Form saved", form);
});
