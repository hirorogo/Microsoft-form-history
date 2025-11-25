import { useEffect, useState } from "react";
import { LocalAnswers, LocalForms } from "@/utils/types";
import "./App.css";
import { answerToString, getLocalAnswerKey } from "@/utils/utils";

// 回答ごとに表示するための整形済みデータ
interface DisplayAnswer {
  formId: string;
  submissionId: string;
  date: string;
  title: string;
  description?: string;
  isSubmitted: boolean;
  items: DisplayItem[];
}

interface DisplayItem {
  title: string;
  subtitle?: string;
  answer?: string;
  required: boolean;
}

const App = () => {
  const [displayAnswers, setDisplayAnswers] = useState<DisplayAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'draft'>('all');

  const deleteFormsAndAnswers = () => {
    if (confirm('すべての回答履歴を削除しますか？この操作は取り消せません。')) {
      chrome.storage.local.remove(["forms", "answers"]);
      setDisplayAnswers([]);
    }
  };

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString("ja-JP") + " " + 
           dateObj.toLocaleTimeString("ja-JP", { hour: '2-digit', minute: '2-digit' });
  };

  const deleteAnswer = async (formId: string, submissionId: string) => {
    if (confirm('この回答履歴を削除しますか？')) {
      // ローカルから削除
      const key = getLocalAnswerKey(formId, submissionId);
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
        prev.filter((v) => !(v.formId === formId && v.submissionId === submissionId))
      );
    }
  };

  const openForm = (formId: string) => {
    // Microsoftフォームのリンクを生成
    let formUrl = "";
    
    // 一般的なMicrosoftフォームのURL形式を試行
    if (formId.includes('Pages')) {
      // ResponsePage.aspx形式
      formUrl = `https://forms.office.com/${formId}`;
    } else {
      // /r/形式
      formUrl = `https://forms.office.com/r/${formId}`;
    }
    
    window.open(formUrl, '_blank');
  };

  const getStatusBadge = (isSubmitted: boolean) => {
    return isSubmitted ? (
      <span className="status-badge submitted">送信済み</span>
    ) : (
      <span className="status-badge draft">下書き</span>
    );
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await chrome.storage.local.get(["forms", "answers"]);
        const forms = (data.forms as LocalForms) ?? {};
        const localAnswers = (data.answers as LocalAnswers) ?? {};

        const displayAnswers: DisplayAnswer[] = Object.values(localAnswers)
          .map(({ formId, submissionId, date, answers, isSubmitted }) => {
            const form = forms[formId];
            if (!form) {
              // フォーム情報がない場合は基本情報のみ表示
              return {
                formId,
                submissionId,
                date,
                title: "不明なフォーム",
                description: "フォーム構造の情報が見つかりません",
                isSubmitted,
                items: Object.entries(answers).map(([questionId, answer]) => ({
                  title: `質問 ${questionId}`,
                  answer: answerToString(answer),
                  required: false
                }))
              } as DisplayAnswer;
            }

            const items: DisplayItem[] = form.items.map((item) => {
              return {
                title: item.title,
                subtitle: item.subtitle,
                answer: answers[item.id] ? answerToString(answers[item.id]) : "",
                required: item.required
              };
            });

            return {
              formId,
              submissionId,
              date,
              title: form.title,
              description: form.description,
              isSubmitted,
              items,
            } as DisplayAnswer;
          })
          .filter((v): v is DisplayAnswer => v !== null)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        setDisplayAnswers(displayAnswers);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load data:", error);
        setLoading(false);
      }
    })();
  }, []);

  const filteredAnswers = displayAnswers.filter(answer => {
    switch (filter) {
      case 'submitted':
        return answer.isSubmitted;
      case 'draft':
        return !answer.isSubmitted;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div id="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="container">
      <header id="header">
        <h1>📋 Microsoft Form 履歴</h1>
        <div className="header-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as 'all' | 'submitted' | 'draft')}
            className="filter-select"
          >
            <option value="all">すべて ({displayAnswers.length})</option>
            <option value="submitted">送信済み ({displayAnswers.filter(a => a.isSubmitted).length})</option>
            <option value="draft">下書き ({displayAnswers.filter(a => !a.isSubmitted).length})</option>
          </select>
          <button onClick={deleteFormsAndAnswers} className="delete-all-btn">
            すべて削除
          </button>
        </div>
      </header>

      {filteredAnswers.length === 0 ? (
        <div className="empty-state">
          <p>
            {filter === 'all' 
              ? '保存された回答履歴はありません' 
              : filter === 'submitted'
              ? '送信済みの回答はありません'
              : '下書きの回答はありません'
            }
          </p>
          <small>Microsoftフォームを回答すると、ここに履歴が表示されます。</small>
        </div>
      ) : (
        <div id="forms">
          {filteredAnswers.map(({ formId, submissionId, date, title, description, isSubmitted, items }) => (
            <details key={`${formId}-${submissionId}`} className={`form ${isSubmitted ? 'submitted' : 'draft'}`}>
              <summary>
                <div className="form-header">
                  <div className="form-title">
                    <h3>{title}</h3>
                    {description && <p className="form-description">{description}</p>}
                  </div>
                  <div className="form-meta">
                    {getStatusBadge(isSubmitted)}
                    <time className="form-date">{formatDate(date)}</time>
                  </div>
                </div>
              </summary>
              
              <div className="qa-list">
                {items.map(({ title: questionTitle, subtitle, answer, required }, i) => (
                  <div key={i} className={`qa-item ${required ? 'required' : ''} ${!answer ? 'empty' : ''}`}>
                    <div className="question-header">
                      <h4 className="question">
                        {questionTitle}
                        {required && <span className="required-mark">*</span>}
                      </h4>
                      {subtitle && <p className="subtitle">{subtitle}</p>}
                    </div>
                    <div className="answer">
                      {answer ? (
                        <p>{answer}</p>
                      ) : (
                        <p className="empty-answer">未回答</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <footer className="form-footer">
                <button
                  onClick={() => openForm(formId)}
                  className="primary-btn"
                >
                  📝 フォームを開く
                </button>
                <button
                  onClick={() => deleteAnswer(formId, submissionId)}
                  className="danger-btn"
                >
                  🗑️ 削除
                </button>
              </footer>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
