(() => {
  // Microsoftフォームのサーバー情報を取得
  if (typeof window.OfficeFormServerInfo === "undefined") {
    console.error("[microsoft-form-history] OfficeFormServerInfo is not defined.");
    return;
  }

  // フォーム情報をContent Scriptに送信
  window.postMessage(
    {
      source: "microsoft-form-history",
      type: "SERVER_INFO",
      payload: window.OfficeFormServerInfo,
    },
    window.location.origin
  );

  // フォームの読み込み完了を監視
  const checkFormLoaded = () => {
    // フォームが読み込まれているかチェック
    const formContainer = document.querySelector('div[data-automation-id="questionnaireContainer"]') ||
                         document.querySelector('form') ||
                         document.querySelector('[role="main"]');
    
    if (formContainer) {
      window.postMessage(
        {
          source: "microsoft-form-history",
          type: "FORM_LOADED",
          payload: {
            timestamp: Date.now(),
            url: window.location.href
          },
        },
        window.location.origin
      );
      return true;
    }
    return false;
  };

  // フォームの読み込み状態をチェック
  if (!checkFormLoaded()) {
    // DOMが準備できるまで待機
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkFormLoaded, 1000);
      });
    } else {
      setTimeout(checkFormLoaded, 1000);
    }
  }

  // フォーム送信の監視
  const observeFormSubmission = () => {
    // 送信ボタンの監視
    const submitButtons = document.querySelectorAll('button[type="submit"], button[data-automation-id*="submit"]');
    submitButtons.forEach(button => {
      button.addEventListener('click', () => {
        window.postMessage(
          {
            source: "microsoft-form-history",
            type: "FORM_SUBMITTING",
            payload: {
              timestamp: Date.now(),
              url: window.location.href
            },
          },
          window.location.origin
        );
      });
    });

    // フォーム送信完了の監視（URLの変化）
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        
        // 送信完了ページかチェック
        if (window.location.href.includes('thankyou') || 
            document.title.includes('送信完了') ||
            document.title.includes('Thank you')) {
          window.postMessage(
            {
              source: "microsoft-form-history",
              type: "FORM_SUBMITTED",
              payload: {
                timestamp: Date.now(),
                url: window.location.href
              },
            },
            window.location.origin
          );
        }
      }
    });

    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // ページの読み込み完了後にフォーム送信の監視を開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeFormSubmission);
  } else {
    observeFormSubmission();
  }
})();
