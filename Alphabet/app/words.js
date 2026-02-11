window.APP = window.APP || {};
APP.words = {};

APP.words.openLetters = () => {
  const root = APP.$("alphabet");
  root.innerHTML = "";

  const words = window.DATA.LISTE_MOTS_FRANCAIS || [];
  const counts = {};
  for (const w of words){
    const n = APP.normalizeText(w);
    const letter = (n[0] || "").toUpperCase();
    if (!letter) continue;
    counts[letter] = (counts[letter] || 0) + 1;
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const L of letters){
    const btn = document.createElement("button");
    btn.className = "letter-btn";
    btn.type = "button";
    btn.innerHTML = `
      <div class="letter-top">${L}</div>
      <div class="letter-sub">${counts[L] || 0} mots</div>
    `;
    btn.onclick = () => APP.words.start(L);
    root.appendChild(btn);
  }

  APP.showScreen("letters");
};

APP.words.start = (letter) => {
  APP.store.selectedMode = "words";
  APP.store.words.letter = letter;
  APP.store.words.found = new Set();

  const total = (window.DATA.LISTE_MOTS_FRANCAIS || [])
    .map(w => APP.normalizeText(w))
    .filter(n => n.startsWith(APP.normalizeText(letter))).length;

  APP.$("gameTitle").textContent = "Tous les mots";
  APP.$("gameSubtitle").textContent = `Lettre : ${letter} — Trouve le maximum de mots.`;
  APP.$("letterChip").textContent = letter;

  APP.$("totalCount").textContent = String(total);
  APP.$("progressCount").textContent = "0";
  APP.$("progressLabel").textContent = "0% complété";
  APP.$("barFill").style.width = "0%";

  APP.$("foundWords").innerHTML = "";
  APP.$("foundCount").textContent = "0";
  APP.$("feedback").textContent = "";
  APP.$("emptyState").style.display = "block";
  APP.$("foundLabel").innerHTML = `Trouvés (<span id="foundCount">0</span>)`;

  APP.$("wordInput").value = "";
  APP.showScreen("game");
  APP.$("wordInput").focus();
};

APP.words.submit = (raw) => {
  const input = APP.$("wordInput");
  const clearBad = () => { input.value = ""; input.focus(); };

  const letter = APP.store.words.letter || "A";
  const entryN = APP.normalizeText(raw);

  if (!entryN){
    APP.$("feedback").style.color = "#dc2626";
    APP.$("feedback").textContent = "Vide.";
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  if (!entryN.startsWith(APP.normalizeText(letter))){
    APP.$("feedback").style.color = "#dc2626";
    APP.$("feedback").textContent = `Doit commencer par "${letter}".`;
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  const listN = (window.DATA.LISTE_MOTS_FRANCAIS || []).map(w => APP.normalizeText(w));
  if (!listN.includes(entryN)){
    APP.$("feedback").style.color = "#dc2626";
    APP.$("feedback").textContent = "Mot absent de la liste.";
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  if (APP.store.words.found.has(entryN)){
    APP.$("feedback").style.color = "#ca8a04";
    APP.$("feedback").textContent = "Déjà trouvé.";
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  APP.store.words.found.add(entryN);
  const li = document.createElement("li");
  li.textContent = raw;
  APP.$("foundWords").appendChild(li);

  input.value = "";
  input.focus();

  const current = APP.store.words.found.size;
  const total = Number(APP.$("totalCount").textContent) || 0;
  const pct = total ? Math.round((current / total) * 100) : 0;

  APP.$("progressCount").textContent = String(current);
  APP.$("progressLabel").textContent = `${pct}% complété`;
  APP.$("barFill").style.width = `${pct}%`;
  APP.$("feedback").style.color = "#16a34a";
  APP.$("feedback").textContent = "✅ Valide !";
  APP.playFeedbackSound("positive");

  const countEl = document.querySelector("#foundCount");
  if (countEl) countEl.textContent = String(current);
  APP.$("emptyState").style.display = current > 0 ? "none" : "block";
};
