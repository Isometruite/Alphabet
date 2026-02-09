window.APP = window.APP || {};

window.addEventListener("DOMContentLoaded", () => {
  APP.initRouter();
  APP.ensureListsLoaded();

  const setChoice = (ids, activeId) => {
    ids.forEach(id => {
      const el = APP.$(id);
      if (!el) return;
      el.classList.toggle("selected", id === activeId);
    });
  };

  const showPlayersChoice = (show) => {
    const t = APP.$("playersTitle");
    const r = APP.$("playersRow");
    if (!t || !r) return;
    t.style.display = show ? "block" : "none";
    r.style.display = show ? "flex" : "none";
  };

  const setReadyButtonUI = (isReady) => {
    const btn = APP.$("readyBtn");
    if (!btn) return;
    btn.textContent = isReady ? "✅ Prêt" : "⏳ Pas prêt";
    btn.classList.toggle("ready-on", isReady);
  };

  // HOME modes
  const setMode = (mode) => {
    APP.store.selectedMode = mode;
    APP.$("modeWords").classList.toggle("selected", mode === "words");
    APP.$("modeCountries").classList.toggle("selected", mode === "countries");
  };

  setMode(APP.store.selectedMode || "words");

  APP.$("modeWords").onclick = () => setMode("words");
  APP.$("modeCountries").onclick = () => setMode("countries");
  APP.$("modeDefis").onclick = () => APP.showScreen("defisHome");

  APP.$("continueBtn").onclick = () => {
    if (APP.store.selectedMode === "words") APP.words.openLetters();
    else if (APP.store.selectedMode === "countries") APP.countries.start();
    else APP.showScreen("defisHome");
  };

  // Navigation
  APP.$("backFromLetters").onclick = () => APP.showScreen("home");
  APP.$("changeBtn").onclick = () => {
    if (APP.store.selectedMode === "words") APP.words.openLetters();
    else APP.showScreen("home");
  };

  APP.$("backFromDefisHome").onclick = () => APP.showScreen("home");
  APP.$("backFromDefisCoop").onclick = () => APP.showScreen("defisHome");
  APP.$("backFromJoin").onclick = () => APP.showScreen("defisCoop");
  APP.$("backFromDefisSetup").onclick = () => APP.showScreen("defisHome");
  APP.$("backFromLobby").onclick = () => APP.showScreen("defisCoop");
  APP.$("backToDefisSetup").onclick = () => APP.showScreen("defisHome");
  APP.$("backFromSuccess").onclick = () => APP.showScreen("defisHome");
  APP.$("backFromFail").onclick = () => APP.showScreen("defisHome");

  // Words/Countries submit
  APP.$("wordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = APP.$("wordInput").value.trim();
    if (!raw) return;
    if (APP.store.selectedMode === "words") APP.words.submit(raw);
    else APP.countries.submit(raw);
  });

  // Defis submit
  APP.$("defisForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = APP.$("defisInput").value.trim();
    if (!raw) return;
    APP.defis.submit(raw);
  });

  // Defis: Solo / Coop
  APP.$("defisSoloBtn").onclick = () => {
    APP.defis.resetCoop();
    APP.store.defis.isCoop = false;

    APP.$("teamField").style.display = "none";
    showPlayersChoice(false);

    setChoice(["defis5","defis10","defisInf"], "defis10");
    APP.store.defis.countChoice = 10;

    APP.defis.generateRounds(false);
    APP.defis.renderRounds();
    APP.showScreen("defisSetup");
  };

  APP.$("defisCoopBtn").onclick = () => {
    APP.defis.resetCoop();
    APP.store.defis.isCoop = true;
    APP.showScreen("defisCoop");
  };

  // Coop: create/join
  APP.$("defisCreateBtn").onclick = () => {
    APP.store.defis.isCoop = true;

    APP.$("teamField").style.display = "block";
    showPlayersChoice(true);

    setChoice(["defis5","defis10","defisInf"], "defis10");
    APP.store.defis.countChoice = 10;

    setChoice(["p2","p3","p4"], "p2");
    APP.store.defis.expectedPlayers = 2;

    APP.defis.generateRounds(false);
    APP.defis.renderRounds();
    APP.showScreen("defisSetup");
  };

  APP.$("defisJoinBtn").onclick = () => {
    APP.store.defis.isCoop = true;
    APP.$("joinName").value = "";
    APP.$("joinCode").value = "";
    APP.$("joinFeedback").textContent = "";
    APP.showScreen("defisJoin");
    APP.$("joinName").focus();
  };

  // Setup: count
  APP.$("defis5").onclick = () => {
    APP.store.defis.countChoice = 5;
    setChoice(["defis5","defis10","defisInf"], "defis5");
    APP.defis.generateRounds(false);
    APP.defis.renderRounds();
  };
  APP.$("defis10").onclick = () => {
    APP.store.defis.countChoice = 10;
    setChoice(["defis5","defis10","defisInf"], "defis10");
    APP.defis.generateRounds(false);
    APP.defis.renderRounds();
  };
  APP.$("defisInf").onclick = () => {
    APP.store.defis.countChoice = Infinity;
    setChoice(["defis5","defis10","defisInf"], "defisInf");
    APP.defis.generateRounds(false);
    APP.defis.renderRounds();
  };

  // Setup: expected players
  APP.$("p2").onclick = () => { APP.store.defis.expectedPlayers = 2; setChoice(["p2","p3","p4"], "p2"); };
  APP.$("p3").onclick = () => { APP.store.defis.expectedPlayers = 3; setChoice(["p2","p3","p4"], "p3"); };
  APP.$("p4").onclick = () => { APP.store.defis.expectedPlayers = 4; setChoice(["p2","p3","p4"], "p4"); };

  APP.$("regenBtn").onclick = () => {
    APP.defis.generateRounds(true);
    APP.defis.renderRounds();
  };

  // Create party
  APP.$("createDefisBtn").onclick = () => {
    const name = (APP.$("playerName").value || "").trim() || "Joueur";

    if (APP.store.defis.isCoop) {
      const code = APP.defis.hostCreate(name);

      // reset ready state UI
      APP.store.defis.myReady = false;
      setReadyButtonUI(false);

      APP.defis.openLobby(code);
      return;
    }

    APP.store.defis.currentIndex = 0;
    const startAt = Date.now() + 2200;
    APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(0));
  };

  // Join confirm
  APP.$("joinConfirmBtn").onclick = () => {
    const name = (APP.$("joinName").value || "").trim() || "Joueur";
    const code = (APP.$("joinCode").value || "").trim().toUpperCase();

    const out = APP.defis.joinCoop(name, code);
    if (!out.ok) {
      APP.$("joinFeedback").style.color = "#dc2626";
      APP.$("joinFeedback").textContent = out.error;
      return;
    }

    APP.store.defis.myReady = false;
    setReadyButtonUI(false);
    APP.$("lobbyFeedback").style.color = "#64748b";
    APP.$("lobbyFeedback").textContent = "⏳ Pas prêt — clique pour te mettre prêt.";
  };

  // Ready toggle (host + joiner)
  setReadyButtonUI(false);
  APP.$("readyBtn").onclick = () => {
    const next = !APP.store.defis.myReady;
    APP.store.defis.myReady = next;
    APP.defis.setMyReady(next);
    setReadyButtonUI(next);

    APP.$("lobbyFeedback").style.color = next ? "#16a34a" : "#64748b";
    APP.$("lobbyFeedback").textContent = next ? "✅ Prêt" : "⏳ Pas prêt";
  };

  // "Manche suivante" (coop synced)
  APP.$("nextFromSuccess").onclick = () => {
    if (APP.store.defis.isCoop) {
      if (!APP.store.defis.isHost) return;
      APP.defis.coopNextRound();
      return;
    }

    const next = (APP.store.defis.currentIndex || 0) + 1;
    if (!APP.store.defis.rounds || next >= APP.store.defis.rounds.length) {
      APP.showScreen("defisHome");
      return;
    }
    const startAt = Date.now() + 2200;
    APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(next));
  };

  // Fail buttons (simple)
  APP.$("retryBtn").onclick = () => {
    if (APP.store.defis.isCoop && !APP.store.defis.isHost) return;
    const idx = APP.store.defis.currentIndex || 0;
    const startAt = Date.now() + 2200;
    APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(idx));
  };

  APP.$("skipBtn").onclick = () => {
    if (APP.store.defis.isCoop && !APP.store.defis.isHost) return;

    const next = (APP.store.defis.currentIndex || 0) + 1;
    if (!APP.store.defis.rounds || next >= APP.store.defis.rounds.length) {
      APP.showScreen("defisHome");
      return;
    }

    if (APP.store.defis.isCoop) {
      // in coop, host uses coopNextRound for consistent endAt/startAt
      APP.defis.coopNextRound();
      return;
    }

    const startAt = Date.now() + 2200;
    APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(next));
  };

  // Start
  APP.showScreen("home");
});
