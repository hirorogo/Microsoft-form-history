import { useEffect, useState } from "react";
import "./App.css";
import { LocalAnswers, LocalForms } from "@/utils/types";

// 回答ごとに表示するための整形済みデータ
interface DisplayAnswer {
  formId: string;
  fbzx: string;
  date: string;
  title: string;
  items: DisplayItem[];
}

interface DisplayItem {
  headline: string;
  label: string;
  answers?: string[];
}

const App = () => {
  const [displayAnswers, setDisplayAnswers] = useState<DisplayAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  const deleteFormsAndAnswers = () => {
    chrome.storage.local.remove(["forms", "answers"]);
    setDisplayAnswers([]);
  };

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString();
  };

  useEffect(() => {
    (async () => {
      const data = await chrome.storage.local.get(["forms", "answers"]);
      const forms = (data.forms as LocalForms) ?? {};
      const localAnswers = (data.answers as LocalAnswers) ?? {};

      const displayAnswers: DisplayAnswer[] = Object.values(localAnswers)
        .map(({ formId, fbzx, date, answers }) => {
          const form = forms[formId];
          if (!form) {
            return null;
          }

          const items = form.items.map<DisplayItem>((item) => {
            if (item.answerId && item.answerId in answers) {
              return {
                headline: item.headline,
                label: item.label,
                answers: answers[item.answerId],
              };
            } else {
              return {
                headline: item.headline,
                label: item.label,
              };
            }
          });

          return {
            formId,
            fbzx,
            date: date,
            title: form.title,
            items,
          };
        })
        .filter((v): v is DisplayAnswer => v !== null)
        .reverse(); // 新しい順に表示

      setDisplayAnswers(displayAnswers);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <p>読み込み中...</p>;
  }

  if (displayAnswers.length === 0) {
    return <p>保存された回答はありません</p>;
  }

  return (
    <div id="container">
      <header id="header">
        <h1>保存された回答履歴</h1>
        <a onClick={deleteFormsAndAnswers}>回答履歴を削除</a>
      </header>
      <div id="forms">
        {displayAnswers.map(({ title, date, fbzx, items }) => (
          <details key={fbzx} className="form">
            <summary>
              {title}（{formatDate(date)}）
            </summary>
            <div className="qa-list">
              {items.map(({ headline, label, answers }, i) => (
                <div key={i} className="qa-item">
                  <p className="question">{headline}</p>
                  {label && <p className="label">{label}</p>}
                  {answers && <p className="answer">{answers.join("，")}</p>}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default App;
