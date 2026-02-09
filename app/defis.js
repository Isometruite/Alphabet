window.APP = window.APP || {};
APP.defis = {};

let timerTickId = null;
let coopChannel = null;
let coopCode = null;
let coopStarted = false;

const COLOR_PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];

APP.store = APP.store || {};
APP.store.defis = APP.store.defis || {};

APP.store.defis.isHost = false;
APP.store.defis.isCoop = false;

APP.store.defis.coopPlayers = [];   // [{name, ready, color}]
APP.store.defis.myName = "";
APP.store.defis.myReady = false;

APP.store.defis.expectedPlayers = APP.store.defis.expectedPlayers ?? 2;
APP.store.defis.countChoice = APP.store.defis.countChoice ?? 10;

APP.store.defis.rounds = APP.store.defis.rounds || [];
APP.store.defis.currentIndex = APP.store.defis.currentIndex || 0;
APP.store.defis.found = APP.store.defis.found || []; // [{raw, entryN, by}]

// ---------- helpers ----------
APP.defis.resetCoop = function(){
  if (coopChannel) coopChannel.close();
  coopChannel = null;
  coopCode = null;
  coopStarted = false;

  APP.store.defis.isHost = false;
  APP.store.defis.isCoop = false;
  APP.store.defis.coopPlayers = [];
  APP.store.defis.myName = "";
  APP.store.defis.myReady = false;
};

APP.defis.makeCode4 = function(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<4;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
};

APP.defis.broadcast = function(type, payload){
  if (!coopChannel) return;
  coopChannel.postMessage({ type, payload });
};

APP.defis.findPlayer = function(name){
  return (APP.store.defis.coopPlayers || []).find(p => p.name === name);
};

APP.defis.assignColorForNewPlayer = function(){
  const used = new Set((APP.store.defis.coopPlayers || []).map(p => p.color));
  for (const c of COLOR_PALETTE) if (!used.has(c)) return c;
  return COLOR_PALETTE[Math.floor(Math.random()*COLOR_PALETTE.length)];
};

APP.defis.expected = function(){ return APP.store.defis.expectedPlayers || 2; };

APP.defis.allReadyAndEnoughPlayers = function(){
  const players = APP.store.defis.coopPlayers || [];
  const expected = APP.defis.expected();
  if (players.length !== expected) return false;
  return players.every(p => p.ready);
};

// ---------- countdown ----------
APP.defis.startCountdownAt = function(startAt, onDone){
  APP.showScreen("defisCountdown");
  const tick = () => {
    const msLeft = startAt - Date.now();
    const sec = Math.ceil(msLeft / 1000);
    if (msLeft <= 0){
      APP.$("countdownNumber").textContent = "0";
      onDone && onDone();
      return;
    }
    APP.$("countdownNumber").textContent = String(Math.min(3, Math.max(1, sec)));
    setTimeout(tick, 100);
  };
  tick();
};

// ---------- timer ----------
APP.defis.stopTimer = function(){
  if (timerTickId) clearInterval(timerTickId);
  timerTickId = null;
  APP.$("timerBox").style.display = "none";
};

APP.defis.startTimerUntil = function(endAt, onEnd){
  APP.defis.stopTimer();
  if (!endAt) return;

  APP.$("timerBox").style.display = "block";
  const render = () => {
    const leftSec = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    APP.$("timerValue").textContent = APP.formatMMSS(leftSec);
    if (endAt - Date.now() <= 0){
      APP.defis.stopTimer();
      onEnd && onEnd();
    }
  };
  render();
  timerTickId = setInterval(render, 250);
};

// ---------- rounds ----------
APP.defis.countWordsStarting = function(letter){
  const L = APP.normalizeText(letter);
  return window.DATA.LISTE_MOTS_FRANCAIS.filter(w => APP.normalizeText(w).startsWith(L)).length;
};
APP.defis.clampGoal = function(max, desired){ return max <= 0 ? 0 : Math.min(max, desired); };

APP.defis.generateRounds = function(forceShuffle=false){
  const pool = [];
  const aMax = APP.defis.countWordsStarting("A");
  pool.push({ type:"words_letter", icon:"⏱️", diff:"Facile", diffClass:"diff-easy",
    text:`Trouve ${APP.defis.clampGoal(aMax,2)} mots en "A" en 60s`, goal: APP.defis.clampGoal(aMax,2), letter:"A", seconds:60 });

  const bMax = APP.defis.countWordsStarting("B");
  pool.push({ type:"words_letter", icon:"⏱️", diff:"Moyen", diffClass:"diff-mid",
    text:`Trouve ${APP.defis.clampGoal(bMax,1)} mot en "B" en 45s`, goal: APP.defis.clampGoal(bMax,1), letter:"B", seconds:45 });

  const pMax = window.DATA.LISTE_PAYS_FRANCAIS.length;
  pool.push({ type:"countries_any", icon:"🗺️", diff:"Moyen", diffClass:"diff-mid",
    text:`Cite ${APP.defis.clampGoal(pMax,2)} pays`, goal: APP.defis.clampGoal(pMax,2) });

  pool.push({ type:"countries_any", icon:"👑", diff:"BOSS", diffClass:"diff-boss",
    text:`BOSS : Cite ${APP.defis.clampGoal(pMax,2)} pays sans erreur`, goal: APP.defis.clampGoal(pMax,2) });

  if (forceShuffle) pool.sort(() => Math.random() - 0.5);

  const n = (APP.store.defis.countChoice === Infinity) ? 10 : (APP.store.defis.countChoice || 10);
  APP.store.defis.rounds = pool.slice(0, Math.min(n, pool.length));
};

APP.defis.renderRounds = function(){
  const root = APP.$("roundList");
  root.innerHTML = "";
  (APP.store.defis.rounds || []).forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "round-item";
    el.innerHTML = `
      <div class="round-icon">${r.icon}</div>
      <div class="round-main">
        <div class="round-top">
          <div class="round-name">Round ${i+1}</div>
          <div class="badge-diff ${r.diffClass}">● ${r.diff}</div>
        </div>
        <div class="round-desc">${r.text}</div>
      </div>
    `;
    root.appendChild(el);
  });
};

// ---------- UI play ----------
APP.defis.setFeedback = function(type, msg){
  const el = APP.$("defisFeedback");
  el.style.color = type==="ok" ? "#16a34a" : type==="warn" ? "#ca8a04" : "#dc2626";
  el.textContent = msg;
};

APP.defis.updateRoundProgress = function(goal){
  const current = (APP.store.defis.found || []).length;
  APP.$("defisFound").textContent = String(current);
  APP.$("defisGoal").textContent = String(goal);
  const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
  APP.$("defisPct").textContent = `${pct}% complété`;
  APP.$("defisBar").style.width = `${pct}%`;
  APP.$("defisListCount").textContent = String(current);
  APP.$("defisEmpty").style.display = current > 0 ? "none" : "block";
};

APP.defis.renderFoundList = function(){
  const ul = APP.$("defisList");
  ul.innerHTML = "";
  const items = APP.store.defis.found || [];
  for (const it of items){
    const p = APP.defis.findPlayer(it.by);
    const color = p?.color || "#94a3b8";

    const li = document.createElement("li");
    li.style.borderLeftColor = color;

    const dot = document.createElement("span");
    dot.className = "who-dot";
    dot.style.background = color;

    const text = document.createElement("span");
    text.textContent = it.raw;

    const who = document.createElement("span");
    who.className = "who-name";
    who.textContent = it.by;

    li.appendChild(dot);
    li.appendChild(text);
    li.appendChild(who);
    ul.appendChild(li);
  }
};

APP.defis.openSuccess = function(text){
  APP.defis.stopTimer();
  APP.$("successSub").textContent = text;

  if (APP.store.defis.isCoop){
    const btn = APP.$("nextFromSuccess");
    if (APP.store.defis.isHost){
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = "Manche suivante →";
    } else {
      btn.disabled = true;
      btn.style.opacity = "0.55";
      btn.textContent = "En attente du host…";
    }
  }
  APP.showScreen("defisSuccess");
};

APP.defis.openFail = function(text){
  APP.defis.stopTimer();
  APP.$("failSub").textContent = text;

  if (APP.store.defis.isCoop){
    const retry = APP.$("retryBtn");
    const skip = APP.$("skipBtn");
    if (APP.store.defis.isHost){
      retry.disabled = false; retry.style.opacity = "1";
      skip.disabled = false;  skip.style.opacity = "1";
    } else {
      retry.disabled = true; retry.style.opacity = "0.55";
      skip.disabled = true;  skip.style.opacity = "0.55";
    }
  }
  APP.showScreen("defisFail");
};

// ---------- round start ----------
APP.defis.startRound = function(index, endAt=null){
  APP.store.defis.currentIndex = index;
  APP.store.defis.found = [];

  APP.$("defisFeedback").textContent = "";
  APP.$("defisInput").value = "";
  APP.$("defisInput").focus();

  const r = (APP.store.defis.rounds || [])[index];
  if (!r){
    APP.defis.openFail("Erreur : round introuvable.");
    return;
  }

  APP.$("defisRoundTitle").textContent = `Round ${index+1}`;
  APP.$("defisRoundDesc").textContent = r.text;
  APP.$("defisChip").textContent = r.icon || "⚡";

  APP.defis.updateRoundProgress(r.goal);
  APP.defis.renderFoundList();
  APP.showScreen("defisPlay");

  if (endAt){
    APP.defis.startTimerUntil(endAt, () => {
      if (APP.store.defis.isCoop && APP.store.defis.isHost){
        APP.defis.broadcast("ROUND_FAIL", { text:`Objectif non atteint : ${r.text}` });
      }
      if (!APP.store.defis.isCoop){
        APP.defis.openFail(`Objectif non atteint : ${r.text}`);
      }
    });
    return;
  }

  if (!APP.store.defis.isCoop && r.seconds){
    const localEndAt = Date.now() + (r.seconds * 1000);
    APP.defis.startTimerUntil(localEndAt, () => APP.defis.openFail(`Objectif non atteint : ${r.text}`));
  }
};

// ---------- validation ----------
APP.defis.validateEntryForRound = function(raw){
  const r = (APP.store.defis.rounds || [])[APP.store.defis.currentIndex];
  const entryN = APP.normalizeText(raw);
  if (!entryN) return { ok:false, type:"err", msg:"Vide." };

  const found = APP.store.defis.found || [];
  if (found.some(x => x.entryN === entryN)) return { ok:false, type:"warn", msg:"Déjà trouvé." };

  if (r.type === "countries_any"){
    const listN = window.DATA.LISTE_PAYS_FRANCAIS.map(p => APP.normalizeText(p));
    if (!listN.includes(entryN)) return { ok:false, type:"err", msg:"Pays absent de la liste." };
  } else {
    const listN = window.DATA.LISTE_MOTS_FRANCAIS.map(w => APP.normalizeText(w));
    if (!listN.includes(entryN)) return { ok:false, type:"err", msg:"Mot absent de la liste." };
    if (r.type === "words_letter" && r.letter){
      if (!entryN.startsWith(APP.normalizeText(r.letter))){
        return { ok:false, type:"err", msg:`Le mot doit commencer par "${r.letter}".` };
      }
    }
  }
  return { ok:true, entryN };
};

APP.defis.applyAcceptedEntry = function(raw, entryN, by){
  APP.store.defis.found = APP.store.defis.found || [];
  APP.store.defis.found.push({ raw, entryN, by });

  APP.$("defisInput").value = "";
  APP.$("defisInput").focus();

  APP.defis.setFeedback("ok", "✅ Valide !");
  const r = (APP.store.defis.rounds || [])[APP.store.defis.currentIndex];
  APP.defis.updateRoundProgress(r.goal);
  APP.defis.renderFoundList();
};

APP.defis.submit = function(raw){
  const clearInput = () => { APP.$("defisInput").value = ""; APP.$("defisInput").focus(); };

  if (APP.store.defis.isCoop && !APP.store.defis.isHost){
    APP.defis.broadcast("TRY_ENTRY", { raw, from: APP.store.defis.myName });
    return;
  }

  const res = APP.defis.validateEntryForRound(raw);
  if (!res.ok){
    APP.defis.setFeedback(res.type, res.msg);
    clearInput();
    return;
  }

  const by = APP.store.defis.myName || "Host";
  APP.defis.applyAcceptedEntry(raw, res.entryN, by);

  if (APP.store.defis.isCoop && APP.store.defis.isHost){
    APP.defis.broadcast("ENTRY_ACCEPTED", { raw, entryN: res.entryN, by });
  }

  const r = (APP.store.defis.rounds || [])[APP.store.defis.currentIndex];
  if ((APP.store.defis.found || []).length >= r.goal){
    if (APP.store.defis.isCoop && APP.store.defis.isHost){
      APP.defis.broadcast("ROUND_SUCCESS", { text:`Manche complétée : ${r.text}` });
    }
    if (!APP.store.defis.isCoop){
      APP.defis.openSuccess(`Manche complétée : ${r.text}`);
    }
  }
};

// ---------- lobby ----------
APP.defis.renderLobby = function(){
  const startBtn = APP.$("startCoopBtn");
  if (startBtn) startBtn.style.display = "none";

  const readyBtn = APP.$("readyBtn");
  if (readyBtn) readyBtn.style.display = "block";

  const list = APP.$("lobbyPlayers");
  const empty = APP.$("lobbyEmpty");
  list.innerHTML = "";

  const players = APP.store.defis.coopPlayers || [];
  empty.style.display = players.length ? "none" : "block";

  for (const p of players){
    const li = document.createElement("li");
    li.style.borderLeftColor = p.color || "#94a3b8";

    const dot = document.createElement("span");
    dot.className = "who-dot";
    dot.style.background = p.color || "#94a3b8";

    const label = document.createElement("span");
    label.textContent = `${p.ready ? "✅" : "⏳"} ${p.name}${p.name === (APP.store.defis.coopHost || "") ? " (host)" : ""}`;

    li.appendChild(dot);
    li.appendChild(label);
    list.appendChild(li);
  }

  const expected = APP.defis.expected();
  const readyCount = players.filter(p => p.ready).length;

  APP.$("lobbyFeedback").style.color = "#64748b";
  APP.$("lobbyFeedback").textContent =
    `Prêts : ${readyCount}/${expected} (connectés : ${players.length}/${expected})`;

  if (APP.store.defis.isHost && !coopStarted && APP.defis.allReadyAndEnoughPlayers()){
    coopStarted = true;
    APP.defis.coopStart(0);
  }
};

APP.defis.openLobby = function(code){
  APP.$("lobbyCode").textContent = code;
  APP.defis.renderLobby();
  APP.showScreen("defisLobby");
};

// ---------- coop create/join ----------
APP.defis.hostCreate = function(hostName){
  APP.defis.resetCoop();
  APP.store.defis.isHost = true;
  APP.store.defis.isCoop = true;

  APP.store.defis.coopHost = hostName || "Host";
  APP.store.defis.myName = APP.store.defis.coopHost;
  APP.store.defis.myReady = false;

  const code = APP.defis.makeCode4();
  coopCode = code;

  APP.store.defis.coopPlayers = [{
    name: APP.store.defis.coopHost,
    ready: false,
    color: COLOR_PALETTE[0]
  }];

  localStorage.setItem(`ALPHABET_COOP_${code}`, JSON.stringify({
    host: APP.store.defis.coopHost,
    createdAt: Date.now()
  }));

  coopChannel = new BroadcastChannel(`ALPHABET_COOP_${code}`);

  coopChannel.onmessage = (ev) => {
    const msg = ev.data || {};

    if (msg.type === "JOIN_REQUEST"){
      const name = (msg.payload && msg.payload.name) ? msg.payload.name : "Joueur";
      if (!APP.store.defis.coopPlayers.some(p => p.name === name)){
        APP.store.defis.coopPlayers.push({ name, ready: false, color: APP.defis.assignColorForNewPlayer() });
      }
      APP.defis.broadcast("ROSTER", {
        players: APP.store.defis.coopPlayers,
        expectedPlayers: APP.store.defis.expectedPlayers || 2
      });
      APP.defis.renderLobby();
    }

    if (msg.type === "READY_SET"){
      const { name, ready } = msg.payload || {};
      const p = APP.defis.findPlayer(name);
      if (p){
        p.ready = !!ready;
        APP.defis.broadcast("ROSTER", {
          players: APP.store.defis.coopPlayers,
          expectedPlayers: APP.store.defis.expectedPlayers || 2
        });
        APP.defis.renderLobby();
      }
    }

    if (msg.type === "TRY_ENTRY"){
      const raw = (msg.payload && msg.payload.raw) ? msg.payload.raw : "";
      const from = (msg.payload && msg.payload.from) ? msg.payload.from : "Joueur";

      const res = APP.defis.validateEntryForRound(raw);
      if (!res.ok){
        APP.defis.broadcast("ENTRY_REJECTED", { to: from, type: res.type, msg: res.msg });
        return;
      }

      APP.defis.applyAcceptedEntry(raw, res.entryN, from);
      APP.defis.broadcast("ENTRY_ACCEPTED", { raw, entryN: res.entryN, by: from });

      const r = (APP.store.defis.rounds || [])[APP.store.defis.currentIndex];
      if ((APP.store.defis.found || []).length >= r.goal){
        APP.defis.broadcast("ROUND_SUCCESS", { text:`Manche complétée : ${r.text}` });
      }
    }
  };

  return code;
};

APP.defis.joinCoop = function(name, code){
  APP.defis.resetCoop();
  APP.store.defis.isHost = false;
  APP.store.defis.isCoop = true;

  code = (code || "").trim().toUpperCase();
  if (code.length !== 4) return { ok:false, error:"Code invalide." };

  const sess = localStorage.getItem(`ALPHABET_COOP_${code}`);
  if (!sess) return { ok:false, error:"Aucune partie trouvée (testable en multi-onglets seulement)." };

  coopCode = code;
  coopChannel = new BroadcastChannel(`ALPHABET_COOP_${code}`);

  APP.store.defis.myName = name || "Joueur";
  APP.store.defis.myReady = false;
  APP.store.defis.coopPlayers = [];

  APP.defis.openLobby(code);

  coopChannel.onmessage = (ev) => {
    const msg = ev.data || {};

    if (msg.type === "ROSTER"){
      APP.store.defis.coopPlayers = (msg.payload && msg.payload.players) ? msg.payload.players : [];
      if (msg.payload && msg.payload.expectedPlayers) APP.store.defis.expectedPlayers = msg.payload.expectedPlayers;
      APP.defis.renderLobby();
    }

    if (msg.type === "START"){
      const payload = msg.payload || {};
      const startAt = payload.startAt || (Date.now()+2000);
      const endAt = payload.endAt || null;
      const index = payload.index ?? 0;

      if (payload.expectedPlayers) APP.store.defis.expectedPlayers = payload.expectedPlayers;
      if (Array.isArray(payload.rounds) && payload.rounds.length) APP.store.defis.rounds = payload.rounds;

      APP.store.defis.currentIndex = index;
      APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(index, endAt));
    }

    if (msg.type === "ENTRY_ACCEPTED"){
      const { raw, entryN, by } = msg.payload || {};
      const found = APP.store.defis.found || [];
      if (entryN && !found.some(x => x.entryN === entryN)){
        APP.defis.applyAcceptedEntry(raw, entryN, by || "Joueur");
      } else {
        APP.$("defisInput").value = "";
        APP.$("defisInput").focus();
      }
    }

    if (msg.type === "ENTRY_REJECTED"){
      const { to, type, msg:txt } = msg.payload || {};
      if (to === APP.store.defis.myName){
        APP.defis.setFeedback(type || "err", txt || "Refusé.");
        APP.$("defisInput").value = "";
        APP.$("defisInput").focus();
      }
    }

    if (msg.type === "ROUND_SUCCESS") APP.defis.openSuccess(msg.payload?.text || "Réussi !");
    if (msg.type === "ROUND_FAIL")    APP.defis.openFail(msg.payload?.text || "Échec.");

    if (msg.type === "NEXT_ROUND"){
      const payload = msg.payload || {};
      const startAt = payload.startAt || (Date.now()+2000);
      const endAt = payload.endAt || null;
      const index = payload.index ?? 0;

      APP.store.defis.currentIndex = index;
      APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(index, endAt));
    }
  };

  coopChannel.postMessage({ type:"JOIN_REQUEST", payload:{ name: APP.store.defis.myName } });
  return { ok:true };
};

// Ready toggle (host or joiner)
APP.defis.setMyReady = function(ready){
  if (!coopChannel) return;

  APP.store.defis.myReady = !!ready;
  const p = APP.defis.findPlayer(APP.store.defis.myName);
  if (p) p.ready = APP.store.defis.myReady;

  APP.defis.broadcast("READY_SET", { name: APP.store.defis.myName, ready: APP.store.defis.myReady });
};

// Host start / next
APP.defis.coopStart = function(index){
  if (!coopChannel || !coopCode) return;
  if (!APP.store.defis.isHost) return;

  const r = (APP.store.defis.rounds || [])[index];
  const seconds = (r && r.seconds) ? r.seconds : 0;

  const startAt = Date.now() + 2200;
  const endAt = seconds > 0 ? (startAt + seconds*1000) : null;

  APP.defis.broadcast("START", {
    startAt,
    endAt,
    rounds: APP.store.defis.rounds,
    expectedPlayers: APP.store.defis.expectedPlayers || 2,
    index
  });

  APP.store.defis.currentIndex = index;
  APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(index, endAt));
};

APP.defis.coopNextRound = function(){
  if (!APP.store.defis.isCoop || !APP.store.defis.isHost) return;

  const next = (APP.store.defis.currentIndex || 0) + 1;
  if (!APP.store.defis.rounds || next >= APP.store.defis.rounds.length){
    APP.showScreen("defisHome");
    return;
  }

  const r = APP.store.defis.rounds[next];
  const seconds = (r && r.seconds) ? r.seconds : 0;

  const startAt = Date.now() + 2200;
  const endAt = seconds > 0 ? (startAt + seconds*1000) : null;

  APP.defis.broadcast("NEXT_ROUND", { startAt, endAt, index: next });
  APP.store.defis.currentIndex = next;
  APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(next, endAt));
};
