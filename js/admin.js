// ============================================
// 管理画面のロジック (admin.js)
// ============================================

// DOM要素の取得
const loginScreen = document.getElementById('login-screen');
const adminScreen = document.getElementById('admin-screen');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginAlert = document.getElementById('login-alert');
const logoutBtn = document.getElementById('logout-btn');
const adminEmail = document.getElementById('admin-email');


const surveyFormTitle = document.getElementById('survey-form-title');
const surveyQuestionInput = document.getElementById('survey-question');
const surveyTypeSelect = document.getElementById('survey-type');
const optionsContainer = document.getElementById('options-container');
const addOptionBtn = document.getElementById('add-option-btn');
const saveSurveyBtn = document.getElementById('save-survey-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const surveyManagementList = document.getElementById('survey-management-list');

const adminCommentsList = document.getElementById('admin-comments-list');
const toggleQrBtn = document.getElementById('toggle-qr-btn');
const eventNameInput = document.getElementById('event-name-input');
const saveEventNameBtn = document.getElementById('save-event-name-btn');

let editingSurveyId = null;
let currentShowQrCode = false;
let currentQrPosition = 'bottom-right'; // 編集中のアンケートID(新規作成時はnull)
let currentDisplaySurveyIds = []; // 会場スクリーンに表示中のアンケートIDリスト

// ============================================
// 認証
// ============================================

// 認証状態の監視
auth.onAuthStateChanged((user) => {
  if (user) {
    // ログイン済み
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    adminEmail.textContent = user.email;
    initAdmin();
  } else {
    // 未ログイン
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
  }
});

// ログイン処理
loginBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showLoginAlert('メールアドレスとパスワードを入力してください', 'error');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'ログイン中...';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChangedで画面切り替えされる
  } catch (error) {
    console.error('ログインエラー:', error);
    showLoginAlert('ログインに失敗しました。メールアドレスとパスワードを確認してください。', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'ログイン';
  }
});

// Enterキーでもログイン可能
loginPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// ログアウト処理
logoutBtn.addEventListener('click', async () => {
  await auth.signOut();
});

function showLoginAlert(message, type) {
  loginAlert.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

// QRコード位置ボタンの状態更新
function updateQrPositionButtons(pos) {
  document.querySelectorAll('.qr-pos-btn').forEach(btn => {
    const isActive = btn.dataset.pos === pos;
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-secondary', !isActive);
  });
}

// QRコード位置変更（イベント委譲）
document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('qr-pos-btn')) return;
  const pos = e.target.dataset.pos;
  try {
    await db.collection('appState').doc('current').set({
      qrPosition: pos,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('QR位置変更エラー:', error);
    alert('QRコード位置の変更に失敗しました');
  }
});

// イベント名保存
saveEventNameBtn.addEventListener('click', async () => {
  const name = eventNameInput.value.trim();
  try {
    await db.collection('appState').doc('current').set({
      eventName: name || 'イベント Live',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    saveEventNameBtn.textContent = '保存しました';
    setTimeout(() => { saveEventNameBtn.textContent = '保存'; }, 1500);
  } catch (error) {
    console.error('イベント名保存エラー:', error);
    alert('イベント名の保存に失敗しました');
  }
});

// QRコード表示トグル
toggleQrBtn.addEventListener('click', async () => {
  try {
    await db.collection('appState').doc('current').set({
      showQrCode: !currentShowQrCode,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('QR表示切替エラー:', error);
    alert('QRコード表示の切り替えに失敗しました');
  }
});

// ============================================
// 管理画面の初期化(ログイン後に実行)
// ============================================

function initAdmin() {
  subscribeToAppState();
  subscribeToSurveys();
  subscribeToComments();
}

// ============================================
// 表示モード切り替え
// ============================================

function subscribeToAppState() {
  db.collection('appState').doc('current').onSnapshot((doc) => {
    if (!doc.exists) {
      // 初期データがない場合は作成
      db.collection('appState').doc('current').set({
        displayMode: 'comments',
        displayStyle: 'list',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return;
    }

    const data = doc.data();
    currentShowQrCode = data.showQrCode || false;
    toggleQrBtn.textContent = currentShowQrCode ? 'QRコードを非表示にする' : 'QRコードを表示する';
    toggleQrBtn.className = currentShowQrCode ? 'btn btn-primary' : 'btn btn-secondary';

    currentQrPosition = data.qrPosition || 'bottom-right';
    updateQrPositionButtons(currentQrPosition);

    if (document.activeElement !== eventNameInput) {
      eventNameInput.value = data.eventName || '';
    }

    const newIds = data.displaySurveyIds || [];
    const changed = JSON.stringify([...newIds].sort()) !== JSON.stringify([...currentDisplaySurveyIds].sort());
    if (changed) {
      currentDisplaySurveyIds = newIds;
      updateDisplaySurveyIndicator();
    }
  });
}

function updateDisplaySurveyIndicator() {
  document.querySelectorAll('.survey-item').forEach(item => {
    const id = item.dataset.id;
    const isDisplaying = currentDisplaySurveyIds.includes(id);
    item.classList.toggle('is-displayed', isDisplaying);
    const btn = item.querySelector('.show-on-display-btn');
    if (btn) {
      btn.textContent = isDisplaying ? '会場表示中' : '会場表示';
      btn.classList.toggle('active-display', isDisplaying);
    }
    const badge = item.querySelector('.status-displaying');
    if (isDisplaying && !badge) {
      const header = item.querySelector('.survey-item-header');
      const newBadge = document.createElement('span');
      newBadge.className = 'status-badge status-displaying';
      newBadge.textContent = '会場表示中';
      header.appendChild(newBadge);
    } else if (!isDisplaying && badge) {
      badge.remove();
    }
  });
}


// ============================================
// アンケート管理
// ============================================

// 選択肢追加
addOptionBtn.addEventListener('click', () => {
  const newRow = document.createElement('div');
  newRow.className = 'option-input-row';
  newRow.innerHTML = `
    <input type="text" class="form-input option-input" placeholder="選択肢">
    <button class="btn btn-secondary btn-sm remove-option-btn" type="button">削除</button>
  `;
  optionsContainer.appendChild(newRow);
});

// 選択肢削除(イベント委譲)
optionsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-option-btn')) {
    if (optionsContainer.children.length > 2) {
      e.target.parentElement.remove();
    } else {
      alert('選択肢は最低2つ必要です');
    }
  }
});

// アンケート保存(新規 or 更新)
saveSurveyBtn.addEventListener('click', async () => {
  const question = surveyQuestionInput.value.trim();
  const type = surveyTypeSelect.value;
  const optionInputs = optionsContainer.querySelectorAll('.option-input');
  const options = Array.from(optionInputs)
    .map(input => input.value.trim())
    .filter(val => val !== '');

  // バリデーション
  if (!question) {
    alert('質問文を入力してください');
    return;
  }
  if (options.length < 2) {
    alert('選択肢は最低2つ必要です');
    return;
  }

  saveSurveyBtn.disabled = true;

  try {
    if (editingSurveyId) {
      // 更新
      await db.collection('surveys').doc(editingSurveyId).update({
        question: question,
        type: type,
        options: options
      });
    } else {
      // 新規作成 - orderを既存の最大値+1にする
      const snapshot = await db.collection('surveys')
        .orderBy('order', 'desc')
        .limit(1)
        .get();
      const nextOrder = snapshot.empty ? 1 : snapshot.docs[0].data().order + 1;

      await db.collection('surveys').add({
        question: question,
        type: type,
        options: options,
        isActive: false,
        order: nextOrder,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    resetSurveyForm();
  } catch (error) {
    console.error('保存エラー:', error);
    alert('保存に失敗しました');
  } finally {
    saveSurveyBtn.disabled = false;
  }
});

// 編集キャンセル
cancelEditBtn.addEventListener('click', resetSurveyForm);

// フォームリセット
function resetSurveyForm() {
  editingSurveyId = null;
  surveyFormTitle.textContent = '新規アンケートを作成';
  surveyQuestionInput.value = '';
  surveyTypeSelect.value = 'radio';
  optionsContainer.innerHTML = `
    <div class="option-input-row">
      <input type="text" class="form-input option-input" placeholder="選択肢1">
      <button class="btn btn-secondary btn-sm remove-option-btn" type="button">削除</button>
    </div>
    <div class="option-input-row">
      <input type="text" class="form-input option-input" placeholder="選択肢2">
      <button class="btn btn-secondary btn-sm remove-option-btn" type="button">削除</button>
    </div>
  `;
  saveSurveyBtn.textContent = 'アンケートを作成';
  cancelEditBtn.classList.add('hidden');
}

// アンケート一覧の購読
function subscribeToSurveys() {
  db.collection('surveys')
    .orderBy('order', 'asc')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        surveyManagementList.innerHTML = '<div class="empty-state">アンケートはまだありません</div>';
        return;
      }

      const surveys = [];
      snapshot.forEach((doc) => {
        surveys.push({ id: doc.id, ...doc.data() });
      });

      surveyManagementList.innerHTML = surveys.map((survey) => {
        const isDisplaying = currentDisplaySurveyIds.includes(survey.id);
        const statusBadge = survey.isActive
          ? '<span class="status-badge status-active">公開中</span>'
          : '<span class="status-badge status-inactive">非公開</span>';
        const displayBadge = isDisplaying
          ? '<span class="status-badge status-displaying">会場表示中</span>'
          : '';
        const typeLabel = survey.type === 'radio' ? '単一選択' : '複数選択';

        return `
          <div class="survey-item ${isDisplaying ? 'is-displayed' : ''}" data-id="${survey.id}">
            <div class="survey-item-header">
              <div class="survey-item-question">${escapeHtmlStr(survey.question)}</div>
              ${statusBadge}${displayBadge}
            </div>
            <div class="survey-item-meta">${typeLabel} / ${survey.options.length}選択肢</div>
            <div class="survey-item-options">
              ${survey.options.map(opt => `・${escapeHtmlStr(opt)}`).join('<br>')}
            </div>
            <div class="survey-item-actions">
              <button class="btn btn-primary btn-sm toggle-active-btn" data-id="${survey.id}" data-active="${survey.isActive}">
                ${survey.isActive ? '募集終了' : '回答募集'}
              </button>
              <button class="btn btn-success btn-sm show-on-display-btn ${isDisplaying ? 'active-display' : ''}" data-id="${survey.id}">
                ${isDisplaying ? '会場表示中' : '会場表示'}
              </button>
              <button class="btn btn-secondary btn-sm edit-btn" data-id="${survey.id}">編集</button>
              <button class="btn btn-danger btn-sm delete-btn" data-id="${survey.id}">削除</button>
            </div>
          </div>
        `;
      }).join('');
    });
}

// アンケート操作(イベント委譲)
surveyManagementList.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('toggle-active-btn')) {
    // 参加者向け公開切り替え
    const currentActive = e.target.dataset.active === 'true';
    try {
      await db.collection('surveys').doc(id).update({
        isActive: !currentActive
      });
    } catch (error) {
      console.error('公開切替エラー:', error);
      alert('公開切替に失敗しました');
    }
  } else if (e.target.classList.contains('show-on-display-btn')) {
    // 会場表示トグル（追加 or 削除）
    const isCurrentlyDisplaying = currentDisplaySurveyIds.includes(id);
    try {
      await db.collection('appState').doc('current').set({
        displaySurveyIds: isCurrentlyDisplaying
          ? firebase.firestore.FieldValue.arrayRemove(id)
          : firebase.firestore.FieldValue.arrayUnion(id),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('会場表示切替エラー:', error);
      alert('会場表示の切り替えに失敗しました');
    }
  } else if (e.target.classList.contains('edit-btn')) {
    // 編集モード
    const doc = await db.collection('surveys').doc(id).get();
    const data = doc.data();
    editingSurveyId = id;
    surveyFormTitle.textContent = 'アンケートを編集';
    surveyQuestionInput.value = data.question;
    surveyTypeSelect.value = data.type;
    optionsContainer.innerHTML = data.options.map(opt => `
      <div class="option-input-row">
        <input type="text" class="form-input option-input" value="${escapeHtmlStr(opt)}">
        <button class="btn btn-secondary btn-sm remove-option-btn" type="button">削除</button>
      </div>
    `).join('');
    saveSurveyBtn.textContent = '更新する';
    cancelEditBtn.classList.remove('hidden');
    surveyQuestionInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (e.target.classList.contains('delete-btn')) {
    // 削除
    if (!confirm('このアンケートを削除しますか? 回答データは残ります。')) return;
    try {
      await db.collection('surveys').doc(id).delete();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  }
});

// ============================================
// 投稿コメント一覧の表示
// ============================================

function subscribeToComments() {
  db.collection('comments')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        adminCommentsList.innerHTML = '<div class="empty-state">コメントはまだありません</div>';
        return;
      }

      const comments = [];
      snapshot.forEach((doc) => {
        comments.push({ id: doc.id, ...doc.data() });
      });

      // comment-renderer.jsの関数を利用
      adminCommentsList.innerHTML = comments
        .map(comment => renderAdminComment(comment))
        .join('');
    });
}
