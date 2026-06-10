// ============================================
// Firebase設定テンプレート
// このファイルをコピーして firebase-config.js にリネームし
// Firebase Consoleから取得した値を入力してください
// ============================================
const firebaseConfig = {
  apiKey: "ここにAPIキーを入力",
  authDomain: "ここに入力",
  projectId: "ここに入力",
  storageBucket: "ここに入力",
  messagingSenderId: "ここに入力",
  appId: "ここに入力"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();