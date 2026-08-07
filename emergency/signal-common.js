(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyCqIJHAJtFoOxeK-M9fChyPvu8z8E_pOGU",
    authDomain: "emergy-e15f5.firebaseapp.com",
    projectId: "emergy-e15f5",
    storageBucket: "emergy-e15f5.firebasestorage.app",
    messagingSenderId: "123548770828",
    appId: "1:123548770828:web:904e66916a055a52d64429"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db = firebase.firestore();
  try {
    db.settings({ experimentalAutoDetectLongPolling: true });
  } catch (error) {
    console.info("Firestore 네트워크 설정이 이미 적용되었습니다.", error);
  }

  const STATUS_LABELS = {
    PENDING: "전송 대기",
    RECEIVED: "PC 수신 완료",
    RUNNING: "처리 중",
    SUCCEEDED: "처리 성공",
    FAILED: "처리 실패",
    EXPIRED: "요청 만료"
  };

  function formatKst(value, withSeconds) {
    if (!value) return "-";
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds === false ? undefined : "2-digit",
      hour12: false
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.SignalApp = {
    db,
    AGENT_ID: "office-pc-01",
    COMMANDS: "mailDispatchCommands",
    AGENTS: "mailDispatchAgents",
    STATUS_LABELS,
    formatKst,
    escapeHtml
  };
})();
