(function () {
  "use strict";
  const { db, AGENT_ID, AGENTS, COMMANDS, STATUS_LABELS, formatKst, escapeHtml } = window.SignalApp;
  const $ = (id) => document.getElementById(id);
  let agent = null;
  let sending = false;
  let commandUnsubscribe = null;

  function setMessage(text, type) {
    $("message").textContent = text;
    $("message").className = `notice ${type || ""}`;
  }

  function renderAgent() {
    const lastSeen = agent && agent.lastSeenAt && agent.lastSeenAt.toDate().getTime();
    const online = Boolean(lastSeen && Date.now() - lastSeen < 90000);
    const busy = online && agent.bridgeState === "BUSY";
    $("agentStatus").className = `status ${online ? (busy ? "busy" : "online") : "error"}`;
    $("agentTitle").textContent = online ? (busy ? "회사 PC 처리 중" : "회사 PC 연결됨") : "회사 PC 오프라인";
    $("agentDetail").textContent = lastSeen ? `마지막 상태 신호 ${formatKst(agent.lastSeenAt)}` : "수신 화면의 상태 신호를 기다리고 있습니다.";
    $("sendButton").disabled = !online || busy || sending;
  }

  function renderCommand(data) {
    $("requestEmpty").hidden = true;
    $("requestDetail").hidden = false;
    $("requestStatus").innerHTML = `<span class="badge ${String(data.status).toLowerCase()}">${escapeHtml(STATUS_LABELS[data.status] || data.status)}</span>`;
    $("requestId").textContent = data.requestId || "-";
    $("requestedAt").textContent = formatKst(data.requestedAt);
    $("claimedBy").textContent = data.claimedBy || "-";
    $("resultMessage").textContent = data.resultMessage || "-";

    if (["SUCCEEDED", "FAILED", "EXPIRED"].includes(data.status)) {
      sending = false;
      setMessage(
        data.status === "SUCCEEDED" ? "회사 PC에서 처리 성공 결과를 받았습니다." : data.resultMessage || "요청 처리가 완료되지 않았습니다.",
        data.status === "SUCCEEDED" ? "success" : "error"
      );
      renderAgent();
    } else {
      setMessage("회사 PC의 처리 상태를 기다리고 있습니다.");
    }
  }

  async function sendSignal() {
    if (sending || $("sendButton").disabled) return;
    if (!confirm("회사 PC에 메일 전송 테스트 신호를 보낼까요?\n\n수신자와 메일 내용은 전송되지 않습니다.")) return;
    sending = true;
    renderAgent();
    setMessage("메일 전송 신호를 생성하고 있습니다.");

    try {
      const requestId = `MAIL-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const ref = await db.collection(COMMANDS).add({
        requestId,
        type: "SEND_MAIL",
        mode: "TEST",
        status: "PENDING",
        targetProfile: "INTERNAL_PC_PRESET",
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 180000)),
        claimedBy: null,
        resultMessage: null,
        schemaVersion: 1
      });
      if (commandUnsubscribe) commandUnsubscribe();
      commandUnsubscribe = ref.onSnapshot((snapshot) => renderCommand(snapshot.data()), (error) => {
        sending = false; renderAgent(); setMessage(`결과 확인 실패: ${error.message}`, "error");
      });
    } catch (error) {
      sending = false; renderAgent(); setMessage(`신호 전송 실패: ${error.message}`, "error");
    }
  }

  db.collection(AGENTS).doc(AGENT_ID).onSnapshot((snapshot) => {
    agent = snapshot.exists ? snapshot.data() : null;
    renderAgent();
  }, (error) => setMessage(`PC 상태 확인 실패: ${error.message}`, "error"));

  $("sendButton").addEventListener("click", sendSignal);
  setInterval(renderAgent, 1000);
  renderAgent();
})();
