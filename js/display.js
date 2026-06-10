// ============================================
// 表示画面のロジック (display.js)
// ============================================

// DOM要素の取得
const commentsView = document.getElementById('comments-view');
const surveyView = document.getElementById('survey-view');
const commentsContainer = document.getElementById('comments-container');
const commentsEmpty = document.getElementById('comments-empty');
const surveyResultsContainer = document.getElementById('survey-results-container');
const surveyEmpty = document.getElementById('survey-empty');
const modeIndicator = document.getElementById('mode-indicator');

// ============================================
// 表示モードの監視
// ============================================

db.collection('appState').doc('current').onSnapshot((doc) => {
  if (!doc.exists) {
    // 初期状態:コメント表示モード
    switchToCommentsMode();
    return;
  }

  const data = doc.data();
  if (data.displayMode === 'survey') {
    switchToSurveyMode();
  } else {
    switchToCommentsMode();
  }
}, (error) => {
  console.error('appState取得エラー:', error);
});

function switchToCommentsMode() {
  commentsView.classList.remove('hidden');
  surveyView.classList.add('hidden');
  modeIndicator.textContent = 'コメント表示中';
}

function switchToSurveyMode() {
  commentsView.classList.add('hidden');
  surveyView.classList.remove('hidden');
  modeIndicator.textContent = 'アンケート結果表示中';
}

// ============================================
// コメント一覧のリアルタイム表示
// ============================================

db.collection('comments')
  .where('isHidden', '==', false)
  .orderBy('createdAt', 'desc')
  .limit(50)
  .onSnapshot((snapshot) => {
    if (snapshot.empty) {
      commentsContainer.innerHTML = '';
      commentsEmpty.classList.remove('hidden');
      return;
    }

    commentsEmpty.classList.add('hidden');

    const comments = [];
    snapshot.forEach((doc) => {
      comments.push({ id: doc.id, ...doc.data() });
    });

    // comment-renderer.jsの関数を利用
    commentsContainer.innerHTML = comments
      .map(comment => renderDisplayComment(comment))
      .join('');
  }, (error) => {
    console.error('コメント取得エラー:', error);
  });

// ============================================
// アンケート結果のリアルタイム表示
// ============================================

let activeSurveys = []; // 公開中のアンケート設問
let allResponses = []; // 全回答データ

// アンケート設問の購読
db.collection('surveys')
  .where('isActive', '==', true)
  .orderBy('order', 'asc')
  .onSnapshot((snapshot) => {
    activeSurveys = [];
    snapshot.forEach((doc) => {
      activeSurveys.push({ id: doc.id, ...doc.data() });
    });
    renderSurveyResults();
  });

// 回答の購読
db.collection('responses').onSnapshot((snapshot) => {
  allResponses = [];
  snapshot.forEach((doc) => {
    allResponses.push({ id: doc.id, ...doc.data() });
  });
  renderSurveyResults();
});

// アンケート結果の描画
function renderSurveyResults() {
  if (activeSurveys.length === 0) {
    surveyResultsContainer.innerHTML = '';
    surveyEmpty.classList.remove('hidden');
    return;
  }

  surveyEmpty.classList.add('hidden');

  surveyResultsContainer.innerHTML = activeSurveys.map((survey) => {
    // この設問への回答を抽出
    const responses = allResponses.filter(r => r.surveyId === survey.id);
    const totalResponses = responses.length;

    // 各選択肢の集計
    const counts = {};
    survey.options.forEach(option => {
      counts[option] = 0;
    });
    responses.forEach(response => {
      response.selectedOptions.forEach(opt => {
        if (counts.hasOwnProperty(opt)) {
          counts[opt]++;
        }
      });
    });

    // バーチャートのHTML生成
    const maxCount = Math.max(...Object.values(counts), 1);
    const barsHtml = survey.options.map(option => {
      const count = counts[option];
      const percentage = totalResponses > 0
        ? Math.round((count / totalResponses) * 100)
        : 0;
      const widthPercent = (count / maxCount) * 100;

      return `
        <div class="survey-option-bar">
          <div class="survey-option-label">
            <span>${escapeHtmlStr(option)}</span>
            <span class="survey-option-count">${count}票 (${percentage}%)</span>
          </div>
          <div class="survey-option-bar-container">
            <div class="survey-option-bar-fill" style="width: ${widthPercent}%;">
              ${count > 0 ? count : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="survey-result">
        <h2 class="survey-result-question">${escapeHtmlStr(survey.question)}</h2>
        <p class="survey-result-meta">
          回答数: ${totalResponses}件 / 形式: ${survey.type === 'radio' ? '単一選択' : '複数選択'}
        </p>
        ${barsHtml}
      </div>
    `;
  }).join('');
}
