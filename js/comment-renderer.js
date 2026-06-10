// ============================================
// コメント描画コンポーネント (comment-renderer.js)
// 表示画面と、将来Bパターン拡張時の投稿画面で共通利用
// ============================================

/**
 * 1件のコメントをHTML文字列として生成(表示画面用・ダークテーマ)
 * @param {Object} comment - { id, text, name, isQuestion, createdAt, ... }
 * @returns {string} HTML文字列
 */
function renderDisplayComment(comment) {
  const questionClass = comment.isQuestion ? 'is-question' : '';
  const questionTag = comment.isQuestion
    ? '<span class="display-question-tag">質問</span>'
    : '';
  const timeStr = formatTime(comment.createdAt);

  return `
    <div class="display-comment ${questionClass}" data-id="${comment.id}">
      <div class="display-comment-header">
        <span class="display-comment-name">${escapeHtmlStr(comment.name || '匿名')}</span>
        ${questionTag}
        <span class="display-comment-time">${timeStr}</span>
      </div>
      <div class="display-comment-text">${escapeHtmlStr(comment.text)}</div>
    </div>
  `;
}

/**
 * 1件のコメントをHTML文字列として生成(管理画面用・ライトテーマ)
 * @param {Object} comment
 * @returns {string} HTML文字列
 */
function renderAdminComment(comment) {
  const questionClass = comment.isQuestion ? 'is-question' : '';
  const questionTag = comment.isQuestion
    ? '<span class="question-tag">質問</span>'
    : '';
  const timeStr = formatTime(comment.createdAt);

  return `
    <div class="comment-card ${questionClass}" data-id="${comment.id}">
      <div class="comment-header">
        <span class="comment-name">${escapeHtmlStr(comment.name || '匿名')}</span>
        ${questionTag}
        <span class="comment-time">${timeStr}</span>
      </div>
      <div class="comment-text">${escapeHtmlStr(comment.text)}</div>
    </div>
  `;
}

/**
 * Firestoreのtimestampを時刻文字列に変換
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * HTMLエスケープ(XSS対策)
 */
function escapeHtmlStr(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
