const screens = {
  home: document.getElementById("home"),
  letters: document.getElementById("letters"),
  game: document.getElementById("game")
};

const alphabetDiv = document.getElementById("alphabet");

// Home mode buttons
const modeWordsBtn = document.getElementById("modeWords");
const modeCountriesBtn = document.getElementById("modeCountries");
const continueBtn = document.getElementById("continueBtn");

// Game UI
const gameTitle = document.getElementById("gameTitle");
const gameSubtitle = document.getElementById("gameSubtitle");

const currentLetterSpan = document.getElementById("currentLetter");
const letterChip = document.getElementById("letterChip");

const wordForm = document.getElementById("wordForm");
const wordInput = document.getElementById("wordInput");
const feedback = document.getElementById("feedback");

const foundWordsList = document.getElementById("foundWords");
const foundCountEl = document.getElementById("foundCount");
const emptyState = document.getElementById("emptyState");
const foundLabel = document.getElementById("foundLabel");

const progressCountEl = document.getElementById("progressCount");
const totalCountEl = document.getElementById("totalCount");
const progressLabelEl = document.getElementById("progressLabel");
const barFill = document.getElementById("barFill");

const changeBtn = document.getElementById("changeBtn");

let currentLetter = "";
let foundItems = [];
let selectedMode = "words"; // "words" | "countries"

const TOTAL_PAYS_OFFICIEL = 195;

/* NAVIGATION */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function goHome() {
  showScreen("home");
}

function goLetters() {
  showScreen("letters");
  renderAlphabetWithCounts();
}

/* MODE SELECTION */
function setMode(mode) {
  selectedMode = mode;
  modeWordsBtn.classList.toggle("selected", mode === "words");
  modeCountriesBtn.classList.toggle("selected", mode === "countries");
}

modeWordsBtn.addEventListener("click", () => setMode("words"));
modeCountriesBtn.addEventListener("click", () => setMode("countries"));

continueBtn.addEventListener("click", () => {
  if (selectedMode === "words") {
    showScreen("letters");
    renderAlphabetWithCounts();
  } else {
    startCountriesGame();
  }
});

/* ENTER = VALIDER */
wordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitEntry();
});

/* UTILS */
function normalizeText(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setFeedback(type, msg) {
  if (type === "ok") feedback.style.color = "#16a34a";
  if (type === "warn") feedback.style.color = "#ca8a04";
  if (type === "err") feedback.style.color = "#dc2626";
  feedback.textContent = msg;
}

function updateProgressUI(total) {
  const current = foundItems.length;

  progressCountEl.textContent = String(current);
  totalCountEl.textContent = String(total);

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  progressLabelEl.textContent = `${pct}% complété`;
  barFill.style.width = `${pct}%`;

  foundCountEl.textContent = String(current);
  emptyState.style.display = current > 0 ? "none" : "block";
}

function addFoundItem(label) {
  const li = document.createElement("li");
  li.textContent = label;
  foundWordsList.appendChild(li);
}

/* ---------- MODE "TOUS LES MOTS" ---------- */
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getWordCountForLetter(letter) {
  const L = normalizeText(letter);
  return LISTE_MOTS_FRANCAIS.filter(w => normalizeText(w).startsWith(L)).length;
}

function renderAlphabetWithCounts() {
  alphabetDiv.innerHTML = "";

  alphabet.forEach(letter => {
    const count = getWordCountForLetter(letter);

    const card = document.createElement("div");
    card.className = "letter-card";
    card.role = "button";
    card.tabIndex = 0;

    const letterEl = document.createElement("div");
    letterEl.className = "letter";
    letterEl.textContent = letter;

    const countEl = document.createElement("div");
    countEl.className = "count";
    countEl.textContent = `${count} mot${count > 1 ? "s" : ""} à trouver`;

    card.appendChild(letterEl);
    card.appendChild(countEl);

    card.onclick = () => startWordsGame(letter);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") startWordsGame(letter);
    };

    alphabetDiv.appendChild(card);
  });
}

function startWordsGame(letter) {
  selectedMode = "words";
  currentLetter = letter;
  foundItems = [];

  showScreen("game");
  feedback.textContent = "";
  foundWordsList.innerHTML = "";

  // Titre / sous-titre
  gameTitle.innerHTML = `Lettre : <span id="currentLetter">${letter}</span>`;
  currentLetterSpan.textContent = letter;
  gameSubtitle.textContent = "Trouve tous les mots possibles pour cette lettre.";

  // Label
  foundLabel.innerHTML = `Mots trouvés (<span id="foundCount">0</span>)`;

  // Letter chip visible
  letterChip.style.display = "flex";
  letterChip.textContent = letter;

  wordInput.value = "";
  wordInput.placeholder = `Écris un mot commençant par ${letter}…`;

  changeBtn.textContent = "Changer de lettre";
  changeBtn.onclick = () => goLetters();

  const total = getWordCountForLetter(letter);
  updateProgressUI(total);

  wordInput.focus();
}

function submitWord(raw) {
  const wordN = normalizeText(raw);
  const letterN = normalizeText(currentLetter);

  if (!wordN.startsWith(letterN)) {
    setFeedback("err", "Le mot ne commence pas par la bonne lettre.");
    return;
  }

  const listN = LISTE_MOTS_FRANCAIS.map(w => normalizeText(w));
  if (!listN.includes(wordN)) {
    setFeedback("err", "Mot absent de la liste.");
    return;
  }

  if (foundItems.includes(wordN)) {
    setFeedback("warn", "Mot déjà trouvé.");
    return;
  }

  foundItems.push(wordN);
  addFoundItem(raw);

  const total = getWordCountForLetter(currentLetter);
  setFeedback("ok", `Bien joué ! (${foundItems.length}/${total})`);

  wordInput.value = "";
  updateProgressUI(total);
  wordInput.focus();
}

/* ---------- MODE "PAYS" ---------- */
function startCountriesGame() {
  selectedMode = "countries";
  currentLetter = "";
  foundItems = [];

  showScreen("game");
  feedback.textContent = "";
  foundWordsList.innerHTML = "";

  gameTitle.textContent = "Pays (A → Z)";
  gameSubtitle.textContent = "Trouve le plus de pays possible.";

  foundLabel.innerHTML = `Pays trouvés (<span id="foundCount">0</span>)`;

  // pas de chip
  letterChip.style.display = "none";

  wordInput.value = "";
  wordInput.placeholder = "Écris un pays…";

  changeBtn.textContent = "Changer de mode";
  changeBtn.onclick = () => goHome();

  updateProgressUI(TOTAL_PAYS_OFFICIEL);
  wordInput.focus();
}

function submitCountry(raw) {
  const countryN = normalizeText(raw);

  const listN = LISTE_PAYS_FRANCAIS.map(p => normalizeText(p));
  if (!listN.includes(countryN)) {
    setFeedback("err", "Pays absent de la liste.");
    return;
  }

  if (foundItems.includes(countryN)) {
    setFeedback("warn", "Pays déjà trouvé.");
    return;
  }

  foundItems.push(countryN);
  addFoundItem(raw);

  setFeedback("ok", `Bien joué ! (${foundItems.length}/${TOTAL_PAYS_OFFICIEL})`);

  wordInput.value = "";
  updateProgressUI(TOTAL_PAYS_OFFICIEL);
  wordInput.focus();
}

/* SUBMIT (commun) */
function submitEntry() {
  const raw = wordInput.value.trim();
  if (!raw) return;

  if (selectedMode === "words") submitWord(raw);
  else submitCountry(raw);
}
