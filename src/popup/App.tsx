import { useEffect, useState } from "react";
import { LocalAnswers, LocalForms } from "@/utils/types";
import "./App.css";
import { answerToString, getLocalAnswerKey } from "@/utils/utils";

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
  answer?: string;
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

  const deleteAnswer = async (formId: string, fbzx: string) => {
    // ローカルから削除
    const key = getLocalAnswerKey(formId, fbzx);
    const localAnswers = (await chrome.storage.local.get("answers"))
      .answers as LocalAnswers;
    if (!localAnswers) {
      return;
    }
    if (key in localAnswers) {
      delete localAnswers[key];
      await chrome.storage.local.set({ answers: localAnswers });
    }

    // 表示から削除
    setDisplayAnswers((prev) =>
      prev.filter((v) => !(v.formId === formId && v.fbzx === fbzx))
    );
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

          const items = form.items.map<DisplayItem>(
            ({ headline, label, questions }) => {
              return {
                headline: headline,
                label: label,
                answer: questions
                  .flatMap(({ answerId }) =>
                    answers[answerId] ? answerToString(answers[answerId]) : []
                  )
                  .join("\n"),
              };
            }
          );

          return {
            formId,
            fbzx,
            date,
            title: form.title,
            items,
          };
        })
        .filter((v): v is DisplayAnswer => v !== null)
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

      setDisplayAnswers(displayAnswers);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div id="container">読み込み中……</div>;
  }

  if (displayAnswers.length === 0) {
    return <div id="container">保存された回答はありません</div>;
  }

  return (
    <div id="container">
      <header id="header">
        <h1>保存された回答履歴</h1>
        <a onClick={deleteFormsAndAnswers} role="button">
          すべての回答履歴を削除
        </a>
      </header>
      <div id="forms">
        {displayAnswers.map(({ formId, fbzx, date, title, items }) => (
          <details key={fbzx} className="form">
            <summary>
              {title}（{formatDate(date)}）
            </summary>
            <div className="qa-list">
              {items.map(({ headline, label, answer }, i) => (
                <div key={i} className="qa-item">
                  <p className="question">{headline}</p>
                  {label && <p className="label">{label}</p>}
                  {answer && <p className="answer">{answer}</p>}
                </div>
              ))}
            </div>
            <footer>
              <a
                href={`https://docs.google.com/forms/d/e/${formId}/viewform`}
                target="_blank"
                role="button"
              >
                フォームを開く
              </a>
              <a
                className="red"
                onClick={() => deleteAnswer(formId, fbzx)}
                role="button"
              >
                回答履歴を削除
              </a>
            </footer>
          </details>
        ))}
      </div>
    </div>
  );
};

export default App;
