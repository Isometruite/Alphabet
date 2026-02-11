window.APP = window.APP || {};
APP.countries = {};

APP.countries.start = () => {
  APP.store.selectedMode = "countries";
  APP.store.countries.found = new Set();

  const total = (window.DATA.LISTE_PAYS_FRANCAIS || []).length;

  APP.$("gameTitle").textContent = "Pays";
  APP.$("gameSubtitle").textContent = "Trouve le plus de pays possible.";
  APP.$("letterChip").textContent = "🌍";

  APP.$("totalCount").textContent = String(total);
  APP.$("progressCount").textContent = "0";
  APP.$("progressLabel").textContent = "0% complété";
  APP.$("barFill").style.width = "0%";

  APP.$("foundWords").innerHTML = "";
  APP.$("feedback").textContent = "";
  APP.$("emptyState").style.display = "block";
  APP.$("foundLabel").innerHTML = `Trouvés (<span id="foundCount">0</span>)`;

  APP.$("wordInput").value = "";
  APP.showScreen("game");
  APP.$("wordInput").focus();
};

APP.countries.submit = (raw) => {
  const input = APP.$("wordInput");
  const clearBad = () => { input.value = ""; input.focus(); };

  const entryN = APP.normalizeText(raw);
  if (!entryN){
    APP.$("feedback").style.color = "#dc2626";
    APP.$("feedback").textContent = "Vide.";
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  const listN = (window.DATA.LISTE_PAYS_FRANCAIS || []).map(p => APP.normalizeText(p));
  if (!listN.includes(entryN)){
    APP.$("feedback").style.color = "#dc2626";
    APP.$("feedback").textContent = "Pays absent de la liste.";
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  if (APP.store.countries.found.has(entryN)){
    APP.$("feedback").style.color = "#ca8a04";
    APP.$("feedback").textContent = "Déjà trouvé.";
    APP.playFeedbackSound("negative");
    clearBad();
    return;
  }

  APP.store.countries.found.add(entryN);
  const li = document.createElement("li");
  li.textContent = raw;
  APP.$("foundWords").appendChild(li);

  input.value = "";
  input.focus();

  const current = APP.store.countries.found.size;
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
