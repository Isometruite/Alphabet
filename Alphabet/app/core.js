window.APP = window.APP || {};
APP.store = APP.store || {};
APP.store.selectedMode = APP.store.selectedMode || "words";
APP.store.words = APP.store.words || {};
APP.store.countries = APP.store.countries || {};
APP.store.defis = APP.store.defis || {};

APP.$ = (id) => document.getElementById(id);

APP.showScreen = (id) => {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = APP.$(id);
  if (el) el.classList.add("active");
};

APP.normalizeText = (s) => (s || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

APP.formatMMSS = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

APP.ensureListsLoaded = () => {
  if (!window.DATA) window.DATA = {};
  if (!Array.isArray(window.DATA.LISTE_MOTS_FRANCAIS)) window.DATA.LISTE_MOTS_FRANCAIS = [];
  if (!Array.isArray(window.DATA.LISTE_PAYS_FRANCAIS)) window.DATA.LISTE_PAYS_FRANCAIS = [];
};

APP.initRouter = () => {
  // No URL routing (simple local)
};
