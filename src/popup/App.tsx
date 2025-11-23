import { useEffect, useState } from "react";
import "./App.css";
import { LocalForms } from "@/utils/types";

export default function App() {
  const [forms, setForms] = useState<LocalForms>({});
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    (async () => {
      const formsData = await chrome.storage.local.get("forms");
      if (formsData.forms) {
        setForms(formsData.forms as any);
      }
    })();
  }, []);

  return (
    <div>
      <ul>
        {Object.values(forms).map((form) => (
          <li key={form.path}>
            <h2>{form.title}</h2>
            <ul>
              {form.items.map((item) => (
                <li key={item.id}>{item.headline}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
