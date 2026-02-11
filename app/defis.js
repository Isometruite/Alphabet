window.APP = window.APP || {};
APP.defis = {};

let timerTickId = null;
let coopTransport = null;
let coopCode = null;
let coopStarted = false;
let coopMode = "local";
const DEFAULT_COOP_SERVER = "wss://alphabet-5.onrender.com";

const COLOR_PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];

APP.store = APP.store || {};
APP.store.defis = APP.store.defis || {};

APP.store.defis.isHost = false;
APP.store.defis.isCoop = false;

APP.store.defis.coopPlayers = [];   // [{name, ready, color}]
APP.store.defis.myName = "";
APP.store.defis.myReady = false;
APP.store.defis.coopNotice = "";

APP.store.defis.expectedPlayers = APP.store.defis.expectedPlayers ?? 2;
APP.store.defis.countChoice = APP.store.defis.countChoice ?? 10;
APP.store.defis.levelChoice = APP.store.defis.levelChoice || "normal";

APP.store.defis.rounds = APP.store.defis.rounds || [];
APP.store.defis.currentIndex = APP.store.defis.currentIndex || 0;
APP.store.defis.found = APP.store.defis.found || []; // [{raw, entryN, by}]

// ---------- helpers ----------
APP.defis.resetCoop = function(){
  if (coopTransport) coopTransport.close();
  coopTransport = null;
  coopCode = null;
  coopStarted = false;
  coopMode = "local";

  APP.store.defis.isHost = false;
  APP.store.defis.isCoop = false;
  APP.store.defis.coopPlayers = [];
  APP.store.defis.myName = "";
  APP.store.defis.myReady = false;
  APP.store.defis.coopNotice = "";
};

APP.defis.makeCode4 = function(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<4;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
};

APP.defis.getCoopWsUrls = function(){
  const urls = [];
  const seen = new Set();
  const pushUrl = (raw) => {
    const normalized = APP.defis.normalizeCoopWsUrl(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  const override = window.APP_COOP_WS || localStorage.getItem("ALPHABET_COOP_WS");
  pushUrl(override || DEFAULT_COOP_SERVER);

  // Compat: conserve l'ancien endpoint avec /coop explicite.
  pushUrl("wss://alphabet-5.onrender.com/coop");
  return urls;
};

APP.defis.normalizeCoopWsUrl = function(rawUrl){
  const raw = (rawUrl || "").trim();
  if (!raw) return "";

  let normalized = raw.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  if (!/^wss?:\/\//i.test(normalized)) return "";

  normalized = normalized.replace(/\/+$/, "");
  if (!/\/coop$/i.test(normalized)) normalized = `${normalized}/coop`;
  return normalized;
};

APP.defis.sanitizeServerErrorMessage = function(rawMessage){
  const msg = (rawMessage || "").trim();
  if (!msg) return "Connexion refusée par le serveur coop.";

  if (/roomid\s+is\s+not\s+defined/i.test(msg)){
    return "Serveur coop incompatible. Réessaie dans quelques secondes.";
  }

  return msg;
};

APP.defis.createBroadcastTransport = function(code){
  const channel = new BroadcastChannel(`ALPHABET_COOP_${code}`);
  const transport = {
    onmessage: null,
    send: (data) => channel.postMessage(data),
    close: () => channel.close()
  };
  channel.onmessage = (ev) => transport.onmessage && transport.onmessage(ev.data || {});
  return transport;
};

APP.defis.createWebSocketTransport = function(wsUrl, code, role, name){
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(wsUrl);


    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject({ code: "CONNECTION_TIMEOUT", message: "Connexion au serveur coop impossible." });
    }, 2500);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "HELLO", payload: { code, role, name } }));
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject({ code: "CONNECTION_FAILED", message: "Connexion au serveur coop impossible." });
    };

    ws.onmessage = (ev) => {
      let msg = null;
      try {
        msg = JSON.parse(ev.data);
      } catch (err) {
        return;
      }

      if (!settled && msg.type === "HELLO_OK"){
        settled = true;
        clearTimeout(timeout);
        const transport = {
          onmessage: null,
          send: (data) => ws.send(JSON.stringify({ ...data, code })),
          close: () => ws.close()
        };
        ws.onmessage = (evt) => {
          let data = null;
          try {
            data = JSON.parse(evt.data);
          } catch (err) {
            return;
          }
          transport.onmessage && transport.onmessage(data);
        };
        resolve(transport);
        return;
      }

      if (!settled && msg.type === "HELLO_ERR"){
        settled = true;
        clearTimeout(timeout);
        ws.close();
        reject({
          code: msg.payload?.code || "HELLO_ERR",
          message: APP.defis.sanitizeServerErrorMessage(msg.payload?.message)
        });
      }
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject({ code: "CONNECTION_CLOSED", message: "Connexion au serveur coop fermée." });
      }
    };
  });
};

APP.defis.connectCoopTransport = async function({ code, role, name, allowLocalFallback = true }){
  const wsUrls = APP.defis.getCoopWsUrls();
  if (wsUrls.length && typeof WebSocket !== "undefined"){
    let lastConnectionErr = null;
    for (const wsUrl of wsUrls){
      try {
        const transport = await APP.defis.createWebSocketTransport(wsUrl, code, role, name);
        return { transport, mode: "remote" };
      } catch (err) {
        if (err?.code === "ROOM_NOT_FOUND" || err?.code === "ROOM_EXISTS"){
          throw err;
        }

        const isConnectionErr = ["CONNECTION_TIMEOUT", "CONNECTION_FAILED", "CONNECTION_CLOSED", "HELLO_ERR"].includes(err?.code);
        if (!isConnectionErr){
          throw err;
        }
        lastConnectionErr = err;
      }
    }

    if (!allowLocalFallback && lastConnectionErr){
      throw lastConnectionErr;
    }
  }
  if (!allowLocalFallback){
    throw { code: "NO_TRANSPORT", message: "Aucun transport coop disponible." };
  }
  return { transport: APP.defis.createBroadcastTransport(code), mode: "local" };
};

APP.defis.broadcast = function(type, payload){
  if (!coopTransport) return;
  coopTransport.send({ type, payload });
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
APP.defis.countWordsStartingWithLength = function(letter, length){
  const L = APP.normalizeText(letter);
  return window.DATA.LISTE_MOTS_FRANCAIS.filter((w) => {
    const normalized = APP.normalizeText(w);
    return normalized.startsWith(L) && normalized.length === length;
  }).length;
};
APP.defis.clampGoal = function(max, desired){ return max <= 0 ? 0 : Math.min(max, desired); };

APP.defis.generateRounds = function(forceShuffle=false){
  const n = (APP.store.defis.countChoice === Infinity) ? 10 : (APP.store.defis.countChoice || 10);
  const level = APP.store.defis.levelChoice || "normal";

  const forbiddenLetters = new Set(["Z", "Y", "X", "W", "U", "K", "Q"]);
  const allowedLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .filter((letter) => !forbiddenLetters.has(letter));
  const allowedPrefixes = ["BA", "CO", "PE", "NI", "MA", "RE", "SA", "LA", "PA", "CA", "DE", "SO"];

  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pickAllowedLetter = () => pickOne(allowedLetters);
  const makeLetterRound = ({ diff, diffClass, icon, goal, seconds }) => {
    const letter = pickAllowedLetter();
    const max = APP.defis.countWordsStarting(letter);
    const finalGoal = APP.defis.clampGoal(max, goal);
    return {
      type: "words_letter",
      icon,
      diff,
      diffClass,
      text: seconds
        ? `Trouve ${finalGoal} mots en "${letter}" en ${seconds}s`
        : `Trouve ${finalGoal} mots en "${letter}"`,
      goal: finalGoal,
      letter,
      seconds
    };
  };

  const makeTestRound = () => {
    const letter = pickAllowedLetter();
    const max = APP.defis.countWordsStarting(letter);
    const goal = APP.defis.clampGoal(max, 3);
    return {
      type: "words_letter",
      icon: "🧪",
      diff: "Test",
      diffClass: "diff-easy",
      text: `Trouve ${goal} mots qui commencent par "${letter}" en 20s`,
      goal,
      letter,
      seconds: 20
    };
  };

  const makeMediumExactRound = () => {
    const length = pickOne([4, 5, 6, 7]);
    const letter = pickAllowedLetter();
    const max = APP.defis.countWordsStartingWithLength(letter, length);
    const goal = APP.defis.clampGoal(max, 10);
    return {
      type: "words_letter_exact_lengths",
      icon: "📏",
      diff: "Moyen",
      diffClass: "diff-mid",
      text: `Trouve ${goal} mots en "${letter}" d'exactement ${length} lettres`,
      goal,
      letter,
      exactLengths: [length],
      allowedLetters
    };
  };

  const tierTemplates = {
    facile: [
      () => makeLetterRound({ diff: "Facile", diffClass: "diff-easy", icon: "⏱️", goal: 30, seconds: 120 }),
      () => {
        const letter = pickAllowedLetter();
        return {
          type: "words_letter_maxlen",
          icon: "✂️",
          diff: "Facile",
          diffClass: "diff-easy",
          text: `Trouve 15 mots en "${letter}" de max 5 lettres`,
          goal: 15,
          maxLen: 5,
          allowedLetters: [letter]
        };
      },
      () => ({
        type: "words_prefix2",
        icon: "🔤",
        diff: "Facile",
        diffClass: "diff-easy",
        prefix: pickOne(allowedPrefixes),
        text: `Trouve 25 mots qui commencent par "${pickOne(allowedPrefixes)}"`,
        goal: 25
      })
    ],
    moyen: [
      () => makeLetterRound({ diff: "Moyen", diffClass: "diff-mid", icon: "⏱️", goal: 40, seconds: 90 }),
      () => ({
        type: "countries_any",
        icon: "🗺️",
        diff: "Moyen",
        diffClass: "diff-mid",
        text: "Cite 15 pays",
        goal: APP.defis.clampGoal(window.DATA.LISTE_PAYS_FRANCAIS.length, 15)
      }),
      () => makeMediumExactRound()
    ],
    difficile: [
      () => makeLetterRound({ diff: "Difficile", diffClass: "diff-hard", icon: "⏱️", goal: 50, seconds: 75 }),
      () => {
        const letter = pickAllowedLetter();
        return {
          type: "words_letter_minlen",
          icon: "📚",
          diff: "Difficile",
          diffClass: "diff-hard",
          text: `Trouve 15 mots en "${letter}" de 7 lettres et + en 60s`,
          goal: 15,
          minLen: 7,
          allowedLetters: [letter],
          seconds: 60
        };
      },
      () => ({
        type: "words_letters_group",
        icon: "🔥",
        diff: "Difficile",
        diffClass: "diff-hard",
        text: "Trouve 20 mots en 60s qui commencent par W, X, Y ou Z",
        goal: 20,
        letters: ["W", "X", "Y", "Z"],
        seconds: 60
      })
    ],
    extreme: [
      () => {
        const letter = pickAllowedLetter();
        const max = APP.defis.countWordsStarting(letter);
        const goal = APP.defis.clampGoal(max, 55);
        return {
          type: "words_letter",
          icon: "👑",
          diff: "Extrême",
          diffClass: "diff-boss",
          text: `Trouve ${goal} mots en 60s avec la lettre "${letter}"`,
          goal,
          letter,
          seconds: 60
        };
      },
      () => {
        const letter = pickAllowedLetter();
        return {
          type: "words_letter_minlen",
          icon: "🧠",
          diff: "Extrême",
          diffClass: "diff-boss",
          text: `Trouve 7 mots en "${letter}" de 9 lettres ou +`,
          goal: 7,
          minLen: 9,
          allowedLetters: [letter]
        };
      }
    ]
  };

  const targetByLevel = {
    test: {
      5: { facile: 5, moyen: 0, difficile: 0, extreme: 0 },
      10: { facile: 10, moyen: 0, difficile: 0, extreme: 0 }
    },
    bebe: {
      5: { facile: 2, moyen: 2, difficile: 1, extreme: 0 },
      10: { facile: 5, moyen: 4, difficile: 1, extreme: 0 }
    },
    normal: {
      5: { facile: 1, moyen: 2, difficile: 1, extreme: 1 },
      10: { facile: 2, moyen: 3, difficile: 3, extreme: 2 }
    },
    demon: {
      5: { facile: 0, moyen: 1, difficile: 2, extreme: 2 },
      10: { facile: 0, moyen: 2, difficile: 4, extreme: 4 }
    }
  };

  const countKey = n <= 5 ? 5 : 10;
  const dist = targetByLevel[level] ? targetByLevel[level][countKey] : targetByLevel.normal[countKey];
  const rounds = [];

  const buildFromTier = (tierName, wanted) => {
    if (!wanted) return;
    const templates = [...(tierTemplates[tierName] || [])];
    if (forceShuffle) templates.sort(() => Math.random() - 0.5);
    for (let i = 0; i < wanted; i++) {
      const make = templates[i % templates.length] || (() => null);
      const round = make();
      if (!round) continue;
      if (round.type === "words_prefix2" && !round.prefix) {
        round.prefix = pickOne(allowedPrefixes);
      }
      if (round.type === "words_prefix2") {
        round.text = `Trouve 25 mots qui commencent par "${round.prefix}"`;
      }
      rounds.push(round);
    }
  };

  if (level === "test"){
    for (let i = 0; i < n; i++) rounds.push(makeTestRound());
    APP.store.defis.rounds = rounds.slice(0, n);
    return;
  }

  // Ordre strict de difficulté
  buildFromTier("facile", dist.facile);
  buildFromTier("moyen", dist.moyen);
  buildFromTier("difficile", dist.difficile);
  buildFromTier("extreme", dist.extreme);

  APP.store.defis.rounds = rounds.slice(0, n);
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

APP.defis.finishRoundSuccess = function(text){
  if (APP.store.defis.isCoop && APP.store.defis.isHost){
    APP.defis.broadcast("ROUND_SUCCESS", { text });
  }
  APP.defis.openSuccess(text);
};

APP.defis.finishRoundFail = function(text){
  if (APP.store.defis.isCoop && APP.store.defis.isHost){
    APP.defis.broadcast("ROUND_FAIL", { text });
  }
  APP.defis.openFail(text);
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

  const diffEl = APP.$("defisRoundDiff");
  if (diffEl){
    diffEl.textContent = `● ${r.diff || "-"}`;
    diffEl.className = `badge-diff ${r.diffClass || ""}`.trim();
  }

  APP.defis.updateRoundProgress(r.goal);
  APP.defis.renderFoundList();
  APP.showScreen("defisPlay");

  if (endAt){
    APP.defis.startTimerUntil(endAt, () => {
      if (!APP.store.defis.isCoop || APP.store.defis.isHost){
        APP.defis.finishRoundFail(`Objectif non atteint : ${r.text}`);
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
    if (r.type === "words_prefix2" && r.prefix){
      if (!entryN.startsWith(APP.normalizeText(r.prefix))){
        return { ok:false, type:"err", msg:`Le mot doit commencer par "${r.prefix}".` };
      }
    }
    if (r.type === "words_letters_group" && Array.isArray(r.letters)){
      const allowed = r.letters.map(l => APP.normalizeText(l));
      if (!allowed.some(letter => entryN.startsWith(letter))){
        return { ok:false, type:"err", msg:`Le mot doit commencer par ${r.letters.join(", ")}.` };
      }
    }
    if (Array.isArray(r.allowedLetters) && r.allowedLetters.length){
      const allowed = r.allowedLetters.map(l => APP.normalizeText(l));
      if (!allowed.some(letter => entryN.startsWith(letter))){
        return { ok:false, type:"err", msg:"Lettre non autorisée pour ce round." };
      }
    }
    if (typeof r.maxLen === "number" && entryN.length > r.maxLen){
      return { ok:false, type:"err", msg:`Maximum ${r.maxLen} lettres.` };
    }
    if (typeof r.minLen === "number" && entryN.length < r.minLen){
      return { ok:false, type:"err", msg:`Minimum ${r.minLen} lettres.` };
    }
    if (Array.isArray(r.exactLengths) && r.exactLengths.length){
      if (!r.exactLengths.includes(entryN.length)){
        return { ok:false, type:"err", msg:`Le mot doit faire ${r.exactLengths.join(", ")} lettres.` };
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
    if (!APP.store.defis.isCoop || APP.store.defis.isHost){
      APP.defis.finishRoundSuccess(`Manche complétée : ${r.text}`);
    }
  }
};

// ---------- lobby ----------
APP.defis.renderLobby = function(){
  const startBtn = APP.$("startCoopBtn");
  if (startBtn) startBtn.style.display = "none";

  const readyBtn = APP.$("readyBtn");
  if (readyBtn) readyBtn.style.display = "block";

  const hint = APP.$("lobbyHint");
  if (hint){
    if (coopMode === "remote"){
      hint.textContent = "Connexion en ligne active. Partage ce code à distance.";
    } else {
      hint.textContent = APP.store.defis.coopNotice
        || "Mode local actif (même appareil). Pour jouer en ligne, démarre le serveur coop.";
    }
  }

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
APP.defis.hostCreate = async function(hostName){
  APP.defis.resetCoop();
  APP.store.defis.isHost = true;
  APP.store.defis.isCoop = true;

  APP.store.defis.coopHost = hostName || "Host";
  APP.store.defis.myName = APP.store.defis.coopHost;
  APP.store.defis.myReady = false;

  let code = APP.defis.makeCode4();
  let transportOut = null;

  for (let i = 0; i < 5; i++){
    try {
      transportOut = await APP.defis.connectCoopTransport({
        code,
        role: "host",
        name: APP.store.defis.coopHost,
        allowLocalFallback: true
      });
      break;
    } catch (err) {
      if (err?.code === "ROOM_EXISTS"){
        code = APP.defis.makeCode4();
        continue;
      }
      throw err;
    }
  }

  if (!transportOut){
    throw { code: "NO_TRANSPORT", message: "Impossible de créer la partie coop." };
  }

  coopCode = code;
  coopTransport = transportOut.transport;
  coopMode = transportOut.mode;
  if (coopMode === "local"){
    APP.store.defis.coopNotice = "Mode local actif (même appareil). Pour jouer en ligne, démarre le serveur coop.";
  }

  APP.store.defis.coopPlayers = [{
    name: APP.store.defis.coopHost,
    ready: false,
    color: COLOR_PALETTE[0]
  }];

  if (coopMode === "local"){
    localStorage.setItem(`ALPHABET_COOP_${code}`, JSON.stringify({
      host: APP.store.defis.coopHost,
      createdAt: Date.now()
    }));
  }

  coopTransport.onmessage = (msg) => {
    const payloadMsg = msg || {};

    if (payloadMsg.type === "JOIN_REQUEST"){
      const name = (payloadMsg.payload && payloadMsg.payload.name) ? payloadMsg.payload.name : "Joueur";
      if (!APP.store.defis.coopPlayers.some(p => p.name === name)){
        APP.store.defis.coopPlayers.push({ name, ready: false, color: APP.defis.assignColorForNewPlayer() });
      }
      APP.defis.broadcast("ROSTER", {
        players: APP.store.defis.coopPlayers,
        expectedPlayers: APP.store.defis.expectedPlayers || 2
      });
      APP.defis.renderLobby();
    }

    if (payloadMsg.type === "READY_SET"){
      const { name, ready } = payloadMsg.payload || {};
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

    if (payloadMsg.type === "TRY_ENTRY"){
      const raw = (payloadMsg.payload && payloadMsg.payload.raw) ? payloadMsg.payload.raw : "";
      const from = (payloadMsg.payload && payloadMsg.payload.from) ? payloadMsg.payload.from : "Joueur";

      const res = APP.defis.validateEntryForRound(raw);
      if (!res.ok){
        APP.defis.broadcast("ENTRY_REJECTED", { to: from, type: res.type, msg: res.msg });
        return;
      }

      APP.defis.applyAcceptedEntry(raw, res.entryN, from);
      APP.defis.broadcast("ENTRY_ACCEPTED", { raw, entryN: res.entryN, by: from });

      const r = (APP.store.defis.rounds || [])[APP.store.defis.currentIndex];
      if ((APP.store.defis.found || []).length >= r.goal){
        APP.defis.finishRoundSuccess(`Manche complétée : ${r.text}`);
      }
    }
  };

  return code;
};

APP.defis.joinCoop = async function(name, code){
  APP.defis.resetCoop();
  APP.store.defis.isHost = false;
  APP.store.defis.isCoop = true;

  code = (code || "").trim().toUpperCase();
  if (code.length !== 4) return { ok:false, error:"Code invalide." };

  let transportOut = null;
  const localSession = localStorage.getItem(`ALPHABET_COOP_${code}`);
  try {
    transportOut = await APP.defis.connectCoopTransport({
      code,
      role: "join",
      name: name || "Joueur",
      allowLocalFallback: !!localSession
    });
  } catch (err) {
    return { ok:false, error: err?.message || "Connexion coop impossible (serveur requis pour jouer en ligne)." };
  }

  if (transportOut.mode === "local"){
    if (!localSession){
      transportOut.transport.close();
      return { ok:false, error:"Aucune partie trouvée (multi-onglets requis en local)." };
    }
  }

  coopCode = code;
  coopTransport = transportOut.transport;
  coopMode = transportOut.mode;

  APP.store.defis.myName = name || "Joueur";
  APP.store.defis.myReady = false;
  APP.store.defis.coopPlayers = [];

  APP.defis.openLobby(code);

  coopTransport.onmessage = (msg) => {
    const payloadMsg = msg || {};

    if (payloadMsg.type === "ROSTER"){
      APP.store.defis.coopPlayers = (payloadMsg.payload && payloadMsg.payload.players) ? payloadMsg.payload.players : [];
      if (payloadMsg.payload && payloadMsg.payload.expectedPlayers) APP.store.defis.expectedPlayers = payloadMsg.payload.expectedPlayers;
      APP.defis.renderLobby();
    }

    if (payloadMsg.type === "START"){
      const payload = payloadMsg.payload || {};
      const startAt = payload.startAt || (Date.now()+2000);
      const endAt = payload.endAt || null;
      const index = payload.index ?? 0;

      if (payload.expectedPlayers) APP.store.defis.expectedPlayers = payload.expectedPlayers;
      if (Array.isArray(payload.rounds) && payload.rounds.length) APP.store.defis.rounds = payload.rounds;

      APP.store.defis.currentIndex = index;
      APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(index, endAt));
    }

    if (payloadMsg.type === "ENTRY_ACCEPTED"){
      const { raw, entryN, by } = payloadMsg.payload || {};
      const found = APP.store.defis.found || [];
      if (entryN && !found.some(x => x.entryN === entryN)){
        APP.defis.applyAcceptedEntry(raw, entryN, by || "Joueur");
      } else {
        APP.$("defisInput").value = "";
        APP.$("defisInput").focus();
      }
    }

    if (payloadMsg.type === "ENTRY_REJECTED"){
      const { to, type, msg:txt } = payloadMsg.payload || {};
      if (to === APP.store.defis.myName){
        APP.defis.setFeedback(type || "err", txt || "Refusé.");
        APP.$("defisInput").value = "";
        APP.$("defisInput").focus();
      }
    }

    if (payloadMsg.type === "ROUND_SUCCESS") APP.defis.openSuccess(payloadMsg.payload?.text || "Réussi !");
    if (payloadMsg.type === "ROUND_FAIL")    APP.defis.openFail(payloadMsg.payload?.text || "Échec.");

    if (payloadMsg.type === "ROOM_CLOSED"){
      APP.defis.resetCoop();
      const feedback = APP.$("joinFeedback");
      if (feedback){
        feedback.style.color = "#dc2626";
        feedback.textContent = payloadMsg.payload?.message || "La partie a été fermée.";
      }
      APP.showScreen("defisHome");
    }

    if (payloadMsg.type === "NEXT_ROUND"){
      const payload = payloadMsg.payload || {};
      const startAt = payload.startAt || (Date.now()+2000);
      const endAt = payload.endAt || null;
      const index = payload.index ?? 0;

      APP.store.defis.currentIndex = index;
      APP.defis.startCountdownAt(startAt, () => APP.defis.startRound(index, endAt));
    }
  };

  coopTransport.send({ type:"JOIN_REQUEST", payload:{ name: APP.store.defis.myName } });
  return { ok:true };
};

// Ready toggle (host or joiner)
APP.defis.setMyReady = function(ready){
  if (!coopTransport) return;

  APP.store.defis.myReady = !!ready;
  const p = APP.defis.findPlayer(APP.store.defis.myName);
  if (p) p.ready = APP.store.defis.myReady;

  APP.defis.broadcast("READY_SET", { name: APP.store.defis.myName, ready: APP.store.defis.myReady });
};

// Host start / next
APP.defis.coopStart = function(index){
  if (!coopTransport || !coopCode) return;
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
