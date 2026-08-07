(function () {
  "use strict";
  const { db, AGENT_ID, AGENTS, COMMANDS, STATUS_LABELS, formatKst, escapeHtml } = window.SignalApp;
  const $ = (id) => document.getElementById(id);
  const agentRef = db.collection(AGENTS).doc(AGENT_ID);
  let activeJob = null;
  let latestPending = [];
  let history = [];
  let claiming = false;

  function setMessage(text, type) {
    $("message").textContent = text;
    $("message").className = `notice ${type || ""}`;
  }

  async function heartbeat() {
    try {
      await agentRef.set({
        agentId: AGENT_ID,
        bridgeState: activeJob ? "BUSY" : "READY",
        intranetSession: "NOT_CONNECTED",
        currentJobId: activeJob ? activeJob.requestId : null,
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
        version: "0.1.0"
      }, { merge: true });
      $("receiverStatus").className = "status online receiver-status";
      $("receiverTitle").textContent = activeJob ? "신호 처리 중" : "실시간 수신 중";
    } catch (error) {
      $("receiverStatus").className = "status error receiver-status";
      $("receiverTitle").textContent = "연결 오류";
      setMessage(`PC 상태 기록 실패: ${error.message}`, "error");
    }
  }

  function renderJob() {
    $("jobCard").className = `job ${activeJob ? "" : "empty"}`;
    $("jobLabel").textContent = activeJob ? "NEW MAIL SIGNAL" : "WAITING";
    $("jobTitle").textContent = activeJob ? "메일 전송 요청을 수신했습니다" : "새로운 신호를 기다리고 있습니다";
    $("jobDetail").textContent = activeJob ? `요청 ID: ${activeJob.requestId}` : "스마트폰에서 테스트 버튼을 누르면 이곳에 즉시 표시됩니다.";
    $("successButton").disabled = !activeJob;
    $("failureButton").disabled = !activeJob;
  }

  function renderHistory() {
    if (!history.length) {
      $("history").innerHTML = '<div class="notice">아직 처리한 테스트 신호가 없습니다.</div>';
      return;
    }
    $("history").innerHTML = history.map((item) => `
      <div class="history-item">
        <div class="history-top"><span class="history-id">${escapeHtml(item.requestId)}</span><span class="badge ${item.status.toLowerCase()}">${escapeHtml(STATUS_LABELS[item.status])}</span></div>
        <div class="history-time">수신 ${escapeHtml(formatKst(item.receivedAt))}</div>
      </div>`).join("");
  }

  async function processPending() {
    if (activeJob || claiming || !latestPending.length) return;
    claiming = true;
    try {
      for (const candidate of latestPending) {
        const ref = db.collection(COMMANDS).doc(candidate.id);
        const expired = candidate.expiresAt && candidate.expiresAt.toDate().getTime() < Date.now();
        if (expired) {
          await ref.update({ status: "EXPIRED", completedAt: firebase.firestore.FieldValue.serverTimestamp(), resultMessage: "PC 수신 전 요청 시간이 만료되었습니다." });
          continue;
        }
        const claimed = await db.runTransaction(async (transaction) => {
          const fresh = await transaction.get(ref);
          if (!fresh.exists || fresh.data().status !== "PENDING") return false;
          transaction.update(ref, { status: "RECEIVED", claimedBy: AGENT_ID, receivedAt: firebase.firestore.FieldValue.serverTimestamp() });
          return true;
        });
        if (claimed) {
          activeJob = Object.assign({}, candidate, { status: "RECEIVED", claimedBy: AGENT_ID, receivedAt: new Date() });
          renderJob();
          setMessage("메일 전송 요청 신호를 수신했습니다. 테스트 처리 결과를 선택해주세요.");
          await heartbeat();
          break;
        }
      }
    } catch (error) {
      setMessage(`신호 선점 실패: ${error.message}`, "error");
    } finally {
      claiming = false;
    }
  }

  async function finishJob(success) {
    if (!activeJob) return;
    const job = activeJob;
    const status = success ? "SUCCEEDED" : "FAILED";
    $("successButton").disabled = true;
    $("failureButton").disabled = true;
    try {
      await db.collection(COMMANDS).doc(job.id).update({ status, completedAt: firebase.firestore.FieldValue.serverTimestamp(), resultMessage: success ? "PC 테스트 처리 완료" : "PC 테스트 처리 실패" });
      history = [Object.assign({}, job, { status }), ...history].slice(0, 5);
      activeJob = null;
      renderJob();
      renderHistory();
      setMessage(success ? "처리 성공 결과를 스마트폰으로 회신했습니다." : "처리 실패 결과를 스마트폰으로 회신했습니다.", success ? "success" : "error");
      await heartbeat();
      setTimeout(processPending, 0);
    } catch (error) {
      setMessage(`결과 회신 실패: ${error.message}`, "error");
      renderJob();
    }
  }

  db.collection(COMMANDS).where("status", "==", "PENDING").limit(10).onSnapshot((snapshot) => {
    latestPending = snapshot.docs.map((doc) => Object.assign({ id: doc.id }, doc.data())).sort((a, b) => {
      const at = a.requestedAt ? a.requestedAt.toMillis() : 0;
      const bt = b.requestedAt ? b.requestedAt.toMillis() : 0;
      return at - bt;
    });
    $("receiverStatus").className = "status online receiver-status";
    $("receiverTitle").textContent = activeJob ? "신호 처리 중" : "실시간 수신 중";
    setMessage(activeJob ? "메일 전송 요청 신호를 처리하고 있습니다." : "실시간 수신 대기 중입니다.");
    processPending();
  }, (error) => {
    $("receiverStatus").className = "status error receiver-status";
    $("receiverTitle").textContent = "실시간 연결 오류";
    setMessage(`실시간 수신 오류: ${error.message}`, "error");
  });

  $("successButton").addEventListener("click", () => finishJob(true));
  $("failureButton").addEventListener("click", () => finishJob(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) heartbeat(); });
  setInterval(heartbeat, 60000);
  renderJob();
  heartbeat();
})();
