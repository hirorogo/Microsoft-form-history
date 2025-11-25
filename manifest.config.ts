import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Microsoft Form History",
  version: pkg.version,
  description: "Microsoftフォームの回答履歴を保存・表示するChrome拡張機能",
  icons: {
    48: "logo.png",
  },
  action: {
    default_icon: {
      48: "logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  permissions: ["storage", "activeTab"],
  content_scripts: [
    {
      js: ["src/content/main.ts"],
      matches: ["https://forms.office.com/*", "https://forms.microsoft.com/*"],
      run_at: "document_idle"
    },
  ],
  web_accessible_resources: [
    {
      resources: ["src/web-accessible-resources.js"],
      matches: ["https://forms.office.com/*", "https://forms.microsoft.com/*"],
    },
  ],
});
