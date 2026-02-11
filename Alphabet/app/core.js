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

APP.audio = APP.audio || {};

APP.playFeedbackSound = (type) => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!APP.audio.ctx) APP.audio.ctx = new AudioCtx();
  const ctx = APP.audio.ctx;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === "positive") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
    return;
  }

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.start(now);
  osc.stop(now + 0.22);
};
