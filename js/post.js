// ============================================
// 投稿画面のロジック (post.js)
// ============================================

// DOM要素の取得
const nameInput = document.getElementById('name-input');
const commentInput = document.getElementById('comment-input');
const isQuestionInput = document.getElementById('is-question-input');
const submitBtn = document.getElementById('submit-btn');
const charCount = document.getElementById('char-count');
const postAlert = document.getElementById('post-alert');

const surveySection = document.getElementById('survey-section');
const surveyList = document.getElementById('survey-list');
const surveySubmitBtn = document.getElementById('survey-submit-btn');
const surveyThanks = document.getElementById('survey-thanks');
const eventNameEl = document.getElementById('event-name');

// イベント名をappStateから取得
db.collection('appState').doc('current').onSnapshot((doc) => {
  if (doc.exists) {
    eventNameEl.textContent = doc.data().eventName || 'イベント';
  }
});

// ============================================
// コメント投稿
// ============================================

// 文字数カウント
commentInput.addEventListener('input', () => {
  charCount.textContent = commentInput.value.length;
});

// アラート表示
function showAlert(message, type = 'success') {
  postAlert.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    postAlert.innerHTML = '';
  }, 3000);
}

// コメント投稿処理
submitBtn.addEventListener('click', async () => {
  const text = commentInput.value.trim();
  const name = nameInput.value.trim();
  const isQuestion = isQuestionInput.checked;

  // バリデーション
  if (!text) {
    showAlert('コメントを入力してください', 'error');
    return;
  }
  if (text.length > 200) {
    showAlert('コメントは200文字以内で入力してください', 'error');
    return;
  }

  // 送信中のUI制御
  submitBtn.disabled = true;
  submitBtn.textContent = '送信中...';

  try {
    await db.collection('comments').add({
      text: text,
      name: name || '匿名',
      isQuestion: isQuestion,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      likeCount: 0,
      isHidden: false
    });

    // フォームをリセット
    commentInput.value = '';
    isQuestionInput.checked = false;
    charCount.textContent = '0';

    showAlert('投稿しました!', 'success');
  } catch (error) {
    console.error('投稿エラー:', error);
    showAlert('投稿に失敗しました。もう一度お試しください。', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '投稿する';
  }
});

// ============================================
// アンケート機能
// ============================================

let activeSurveys = []; // 現在公開中のアンケート設問

// アンケート回答済みかチェック(LocalStorage)
function hasResponded(surveyId) {
  return localStorage.getItem(`survey_response_${surveyId}`) === 'true';
}

// アンケート回答を記録(LocalStorage)
function markAsResponded(surveyId) {
  localStorage.setItem(`survey_response_${surveyId}`, 'true');
}

// アンケート設問のリアルタイム購読
db.collection('surveys')
  .where('isActive', '==', true)
  .orderBy('order', 'asc')
  .onSnapshot((snapshot) => {
    activeSurveys = [];
    snapshot.forEach((doc) => {
      activeSurveys.push({ id: doc.id, ...doc.data() });
    });

    renderSurveys();
  }, (error) => {
    console.error('アンケート取得エラー:', error);
  });

// アンケートの描画
function renderSurveys() {
  // 公開中のアンケートがない場合
  if (activeSurveys.length === 0) {
    surveySection.classList.add('hidden');
    surveyThanks.classList.add('hidden');
    return;
  }

  // 全て回答済みの場合は感謝メッセージ
  const unansweredSurveys = activeSurveys.filter(s => !hasResponded(s.id));
  if (unansweredSurveys.length === 0) {
    surveySection.classList.add('hidden');
    surveyThanks.classList.remove('hidden');
    return;
  }

  // 未回答のアンケートを表示
  surveySection.classList.remove('hidden');
  surveyThanks.classList.add('hidden');

  surveyList.innerHTML = unansweredSurveys.map((survey) => {
    const inputType = survey.type === 'radio' ? 'radio' : 'checkbox';
    const inputName = survey.type === 'radio' ? `survey-${survey.id}` : `survey-${survey.id}[]`;

    const optionsHtml = survey.options.map((option, idx) => `
      <label class="form-checkbox" style="margin-bottom: 8px;">
        <input
          type="${inputType}"
          name="${inputName}"
          value="${escapeHtml(option)}"
          data-survey-id="${survey.id}"
        >
        <span>${escapeHtml(option)}</span>
      </label>
    `).join('');

    return `
      <div class="form-group" data-survey-id="${survey.id}">
        <p class="form-label" style="font-size: 15px; margin-bottom: 12px;">
          ${escapeHtml(survey.question)}
          <span style="font-size: 12px; color: #86868b; font-weight: normal;">
            (${survey.type === 'radio' ? '1つ選択' : '複数選択可'})
          </span>
        </p>
        ${optionsHtml}
      </div>
    `;
  }).join('');
}

// HTMLエスケープ(XSS対策)
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// アンケート送信処理
surveySubmitBtn.addEventListener('click', async () => {
  const unansweredSurveys = activeSurveys.filter(s => !hasResponded(s.id));

  // 全設問の回答を収集
  const responses = [];
  for (const survey of unansweredSurveys) {
    const inputs = document.querySelectorAll(`[data-survey-id="${survey.id}"]:checked`);

    if (inputs.length === 0) {
      alert(`「${survey.question}」に回答してください`);
      return;
    }

    const selectedOptions = Array.from(inputs).map(input => input.value);
    responses.push({
      surveyId: survey.id,
      selectedOptions: selectedOptions
    });
  }

  // 送信中のUI制御
  surveySubmitBtn.disabled = true;
  surveySubmitBtn.textContent = '送信中...';

  try {
    // 各回答をFirestoreに保存
    const batch = db.batch();
    for (const response of responses) {
      const docRef = db.collection('responses').doc();
      batch.set(docRef, {
        surveyId: response.surveyId,
        selectedOptions: response.selectedOptions,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();

    // LocalStorageに回答済みフラグを記録
    for (const response of responses) {
      markAsResponded(response.surveyId);
    }

    // 表示を更新
    renderSurveys();

  } catch (error) {
    console.error('アンケート送信エラー:', error);
    alert('送信に失敗しました。もう一度お試しください。');
  } finally {
    surveySubmitBtn.disabled = false;
    surveySubmitBtn.textContent = 'アンケートを送信する';
  }
});
