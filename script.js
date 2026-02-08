/* Screens */
const screens = {
  home: document.getElementById("home"),
  letters: document.getElementById("letters"),
  game: document.getElementById("game"),
  defisSetup: document.getElementById("defisSetup"),
  defisPlay: document.getElementById("defisPlay"),
};

function showScreen(name){
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function goHome(){ showScreen("home"); }
function goLetters(){ showScreen("letters"); renderAlphabetWithCounts(); }

/* Home mode selection */
const modeWordsBtn = document.getElementById("modeWords");
const modeCountriesBtn = document.getElementById("modeCountries");
const modeDefisBtn = document.getElementById("modeDefis");
const continueBtn = document.getElementById("continueBtn");

let selectedMode = "words"; // words | countries | defis

function setMode(mode){
  selectedMode = mode;
  modeWordsBtn.classList.toggle("selected", mode === "words");
  modeCountriesBtn.classList.toggle("selected", mode === "countries");
  modeDefisBtn.classList.toggle("selected", mode === "defis");
}

modeWordsBtn.addEventListener("click", () => setMode("words"));
modeCountriesBtn.addEventListener("click", () => setMode("countries"));
modeDefisBtn.addEventListener("click", () => setMode("defis"));

continueBtn.addEventListener("click", () => {
  if (selectedMode === "words") goLetters();
  else if (selectedMode === "countries") startCountriesGame();
  else openDefisSetup();
});

/* Utils */
function normalizeText(s){
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* -------------------- MODE WORDS -------------------- */
const alphabetDiv = document.getElementById("alphabet");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getWordCountForLetter(letter){
  const L = normalizeText(letter);
  return LISTE_MOTS_FRANCAIS.filter(w => normalizeText(w).startsWith(L)).length;
}

function renderAlphabetWithCounts(){
  alphabetDiv.innerHTML = "";
  alphabet.forEach(letter => {
    const count = getWordCountForLetter(letter);

    const card = document.createElement("div");
    card.className = "letter-card";
    card.role = "button";
    card.tabIndex = 0;

    card.innerHTML = `
      <div class="letter">${letter}</div>
      <div class="count">${count} mot${count > 1 ? "s" : ""} à trouver</div>
    `;

    card.onclick = () => startWordsGame(letter);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") startWordsGame(letter);
    };

    alphabetDiv.appendChild(card);
  });
}

/* Shared “game” UI (words/countries only) */
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

wordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitEntry();
});

function setFeedback(type, msg){
  if (type === "ok") feedback.style.color = "#16a34a";
  if (type === "warn") feedback.style.color = "#ca8a04";
  if (type === "err") feedback.style.color = "#dc2626";
  feedback.textContent = msg;
}

function updateProgressUI(total){
  const current = foundItems.length;
  progressCountEl.textContent = String(current);
  totalCountEl.textContent = String(total);

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  progressLabelEl.textContent = `${pct}% complété`;
  barFill.style.width = `${pct}%`;

  foundCountEl.textContent = String(current);
  emptyState.style.display = current > 0 ? "none" : "block";
}

function addFoundItem(label){
  const li = document.createElement("li");
  li.textContent = label;
  foundWordsList.appendChild(li);
}

/* Words game */
function startWordsGame(letter){
  selectedMode = "words";
  currentLetter = letter;
  foundItems = [];

  showScreen("game");
  feedback.textContent = "";
  foundWordsList.innerHTML = "";

  gameTitle.innerHTML = `Lettre : <span id="currentLetter">${letter}</span>`;
  currentLetterSpan.textContent = letter;
  gameSubtitle.textContent = "Trouve tous les mots possibles pour cette lettre.";

  foundLabel.innerHTML = `Mots trouvés (<span id="foundCount">0</span>)`;

  letterChip.style.display = "flex";
  letterChip.textContent = letter;

  wordInput.value = "";
  wordInput.placeholder = `Écris un mot commençant par ${letter}…`;

  changeBtn.textContent = "Changer de lettre";
  changeBtn.onclick = () => goLetters();

  updateProgressUI(getWordCountForLetter(letter));
  wordInput.focus();
}

function submitWord(raw){
  const wordN = normalizeText(raw);
  const letterN = normalizeText(currentLetter);

  if (!wordN.startsWith(letterN)){
    setFeedback("err", "Le mot ne commence pas par la bonne lettre.");
    return;
  }

  const listN = LISTE_MOTS_FRANCAIS.map(w => normalizeText(w));
  if (!listN.includes(wordN)){
    setFeedback("err", "Mot absent de la liste.");
    return;
  }

  if (foundItems.includes(wordN)){
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

/* Countries game */
const TOTAL_PAYS_OFFICIEL = 195;

function startCountriesGame(){
  selectedMode = "countries";
  currentLetter = "";
  foundItems = [];

  showScreen("game");
  feedback.textContent = "";
  foundWordsList.innerHTML = "";

  gameTitle.textContent = "Pays (A → Z)";
  gameSubtitle.textContent = "Trouve le plus de pays possible.";

  foundLabel.innerHTML = `Pays trouvés (<span id="foundCount">0</span>)`;

  letterChip.style.display = "none";

  wordInput.value = "";
  wordInput.placeholder = "Écris un pays…";

  changeBtn.textContent = "Changer de mode";
  changeBtn.onclick = () => goHome();

  updateProgressUI(TOTAL_PAYS_OFFICIEL);
  wordInput.focus();
}

function submitCountry(raw){
  const countryN = normalizeText(raw);

  const listN = LISTE_PAYS_FRANCAIS.map(p => normalizeText(p));
  if (!listN.includes(countryN)){
    setFeedback("err", "Pays absent de la liste.");
    return;
  }

  if (foundItems.includes(countryN)){
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

function submitEntry(){
  const raw = wordInput.value.trim();
  if (!raw) return;

  if (selectedMode === "words") submitWord(raw);
  else if (selectedMode === "countries") submitCountry(raw);
}

/* -------------------- MODE DÉFIS (setup + play minimal) -------------------- */

/* Setup UI */
const playerName = document.getElementById("playerName");
const teamName = document.getElementById("teamName");

const langFR = document.getElementById("langFR");
const langEN = document.getElementById("langEN");
const frCount = document.getElementById("frCount");

const defis5 = document.getElementById("defis5");
const defis10 = document.getElementById("defis10");
const defisInf = document.getElementById("defisInf");

const p1 = document.getElementById("p1");
const p2 = document.getElementById("p2");
const p3 = document.getElementById("p3");
const p4 = document.getElementById("p4");

const regenBtn = document.getElementById("regenBtn");
const roundList = document.getElementById("roundList");
const createDefisBtn = document.getElementById("createDefisBtn");

/* Play UI */
const defisRoundTitle = document.getElementById("defisRoundTitle");
const defisRoundDesc = document.getElementById("defisRoundDesc");
const defisFound = document.getElementById("defisFound");
const defisGoal = document.getElementById("defisGoal");
const defisPct = document.getElementById("defisPct");
const defisBar = document.getElementById("defisBar");
const defisForm = document.getElementById("defisForm");
const defisInput = document.getElementById("defisInput");
const defisChip = document.getElementById("defisChip");
const defisFeedback = document.getElementById("defisFeedback");
const defisList = document.getElementById("defisList");
const defisListCount = document.getElementById("defisListCount");
const defisEmpty = document.getElementById("defisEmpty");
const nextRoundBtn = document.getElementById("nextRoundBtn");

let defisLanguage = "FR";
let defisCountChoice = 10; // 5 | 10 | Infinity
let defisPlayers = 1; // 1..4

let defisRounds = [];
let currentRoundIndex = 0;
let currentRoundFound = [];

function openDefisSetup(){
  // init counts / defaults
  frCount.textContent = `${LISTE_MOTS_FRANCAIS.length} mots`;
  setDefisLanguage("FR");
  setDefisCount(10);
  setDefisPlayers(1);

  generateDefisRounds();
  renderRounds();

  showScreen("defisSetup");
}

function setDefisLanguage(lang){
  defisLanguage = lang;
  langFR.classList.toggle("selected", lang === "FR");
  langEN.classList.toggle("selected", lang === "EN");
}

langFR.addEventListener("click", () => setDefisLanguage("FR"));
langEN.addEventListener("click", () => setDefisLanguage("EN"));

function setDefisCount(n){
  defisCountChoice = n;
  defis5.classList.toggle("selected", n === 5);
  defis10.classList.toggle("selected", n === 10);
  defisInf.classList.toggle("selected", n === Infinity);
  generateDefisRounds();
  renderRounds();
}

defis5.addEventListener("click", () => setDefisCount(5));
defis10.addEventListener("click", () => setDefisCount(10));
defisInf.addEventListener("click", () => setDefisCount(Infinity));

function setDefisPlayers(n){
  defisPlayers = n;
  p1.classList.toggle("selected", n === 1);
  p2.classList.toggle("selected", n === 2);
  p3.classList.toggle("selected", n === 3);
  p4.classList.toggle("selected", n === 4);
}

p1.addEventListener("click", () => setDefisPlayers(1));
p2.addEventListener("click", () => setDefisPlayers(2));
p3.addEventListener("click", () => setDefisPlayers(3));
p4.addEventListener("click", () => setDefisPlayers(4));

regenBtn.addEventListener("click", () => {
  generateDefisRounds(true);
  renderRounds();
});

createDefisBtn.addEventListener("click", () => {
  // Start first round
  currentRoundIndex = 0;
  startDefisRound(0);
});

/* Défis templates (adaptés à tes listes pour être testables) */
function countWordsStarting(letter){
  const L = normalizeText(letter);
  return LISTE_MOTS_FRANCAIS.filter(w => normalizeText(w).startsWith(L)).length;
}
function countWordsPrefix(prefix){
  const P = normalizeText(prefix);
  return LISTE_MOTS_FRANCAIS.filter(w => normalizeText(w).startsWith(P)).length;
}
function countCountries(){
  return LISTE_PAYS_FRANCAIS.length;
}

function clampGoal(max, desired){
  if (max <= 0) return 0;
  return Math.min(max, desired);
}

function generateDefisRounds(forceShuffle=false){
  // pool d’idées “style screenshot”
  const pool = [];

  // Chronométré (affiché comme info, pas de timer réel pour l’instant)
  const aMax = countWordsStarting("A");
  pool.push({
    type: "words_letter",
    icon: "⏱️",
    diff: "Facile",
    diffClass: "diff-easy",
    text: `Trouve ${clampGoal(aMax, 2)} mots en "A" en 60s`,
    goal: clampGoal(aMax, 2),
    letter: "A",
    seconds: 60
  });

  const bMax = countWordsStarting("B");
  pool.push({
    type: "words_letter",
    icon: "⏱️",
    diff: "Moyen",
    diffClass: "diff-mid",
    text: `Trouve ${clampGoal(bMax, 1)} mot en "B" en 45s`,
    goal: clampGoal(bMax, 1),
    letter: "B",
    seconds: 45
  });

  // Préfixes
  const alMax = countWordsPrefix("Al");
  pool.push({
    type: "words_prefix",
    icon: "🔤",
    diff: "Facile",
    diffClass: "diff-easy",
    text: `Trouve ${clampGoal(alMax, 1)} mot commençant par "AL"`,
    goal: clampGoal(alMax, 1),
    prefix: "Al"
  });

  const amMax = countWordsPrefix("Am");
  pool.push({
    type: "words_prefix",
    icon: "🔤",
    diff: "Moyen",
    diffClass: "diff-mid",
    text: `Trouve ${clampGoal(amMax, 2)} mots commençant par "AM"`,
    goal: clampGoal(amMax, 2),
    prefix: "Am"
  });

  // Longueur min (simple)
  const longWords = LISTE_MOTS_FRANCAIS.filter(w => normalizeText(w).length >= 5).length;
  pool.push({
    type: "words_minlen",
    icon: "📏",
    diff: "Moyen",
    diffClass: "diff-mid",
    text: `Trouve ${clampGoal(longWords, 3)} mots de 5+ lettres`,
    goal: clampGoal(longWords, 3),
    minLen: 5
  });

  // Pays
  const cMax = countCountries();
  pool.push({
    type: "countries_any",
    icon: "🗺️",
    diff: "Moyen",
    diffClass: "diff-mid",
    text: `Cite ${clampGoal(cMax, 2)} pays`,
    goal: clampGoal(cMax, 2)
  });

  // Un “Boss” (juste visuel pour le fun)
  pool.push({
    type: "countries_any",
    icon: "👑",
    diff: "BOSS",
    diffClass: "diff-boss",
    text: `BOSS : Cite ${clampGoal(cMax, 2)} pays sans erreur`,
    goal: clampGoal(cMax, 2)
  });

  // Si tu veux plus de variété, duplique quelques variantes
  const cMax2 = countWordsStarting("C");
  pool.push({
    type: "words_letter",
    icon: "🔤",
    diff: "Difficile",
    diffClass: "diff-hard",
    text: `Trouve ${clampGoal(cMax2, 2)} mots en "C"`,
    goal: clampGoal(cMax2, 2),
    letter: "C"
  });

  // Mélange
  const shuffled = [...pool];
  if (forceShuffle) shuffled.sort(() => Math.random() - 0.5);

  const n = (defisCountChoice === Infinity) ? 10 : defisCountChoice; // illimité = 10 visibles pour l’instant
  defisRounds = shuffled.slice(0, Math.min(n, shuffled.length));

  // Si l’utilisateur met “illimité”, on pourra plus tard générer au fil de l’eau.
}

function renderRounds(){
  roundList.innerHTML = "";

  defisRounds.forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "round-item";
    el.innerHTML = `
      <div class="round-icon">${r.icon}</div>
      <div class="round-main">
        <div class="round-top">
          <div class="round-name">Round ${i + 1}</div>
          <div class="badge-diff ${r.diffClass}">● ${r.diff}</div>
        </div>
        <div class="round-desc">${r.text}</div>
      </div>
    `;
    roundList.appendChild(el);
  });
}

/* Play */
defisForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitDefisEntry();
});

nextRoundBtn.addEventListener("click", () => {
  const next = currentRoundIndex + 1;
  if (next >= defisRounds.length){
    defisFeedback.style.color = "#16a34a";
    defisFeedback.textContent = "🎉 Fin des défis (test) !";
    return;
  }
  startDefisRound(next);
});

function setDefisFeedback(type, msg){
  if (type === "ok") defisFeedback.style.color = "#16a34a";
  if (type === "warn") defisFeedback.style.color = "#ca8a04";
  if (type === "err") defisFeedback.style.color = "#dc2626";
  defisFeedback.textContent = msg;
}

function startDefisRound(index){
  currentRoundIndex = index;
  currentRoundFound = [];
  defisList.innerHTML = "";
  defisEmpty.style.display = "block";
  defisListCount.textContent = "0";
  defisFeedback.textContent = "";

  const r = defisRounds[index];
  defisRoundTitle.textContent = `Round ${index + 1}`;
  defisRoundDesc.textContent = r.text;

  defisChip.textContent = r.icon || "⚡";
  defisInput.value = "";
  defisInput.placeholder = (r.type.startsWith("countries")) ? "Écris un pays..." : "Écris un mot...";

  defisGoal.textContent = String(r.goal);
  updateDefisProgress();

  showScreen("defisPlay");
  defisInput.focus();
}

function updateDefisProgress(){
  const goal = Number(defisGoal.textContent || 0);
  const current = currentRoundFound.length;

  defisFound.textContent = String(current);

  const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
  defisPct.textContent = `${pct}% complété`;
  defisBar.style.width = `${pct}%`;

  defisListCount.textContent = String(current);
  defisEmpty.style.display = current > 0 ? "none" : "block";
}

function addDefisFound(label){
  const li = document.createElement("li");
  li.textContent = label;
  defisList.appendChild(li);
}

function submitDefisEntry(){
  const raw = defisInput.value.trim();
  if (!raw) return;

  const r = defisRounds[currentRoundIndex];
  const entryN = normalizeText(raw);

  // dédup
  if (currentRoundFound.includes(entryN)){
    setDefisFeedback("warn", "Déjà trouvé.");
    return;
  }

  // validation selon le type
  if (r.type === "countries_any" || r.type === "countries_region"){
    const listN = LISTE_PAYS_FRANCAIS.map(p => normalizeText(p));
    if (!listN.includes(entryN)){
      setDefisFeedback("err", "Pays absent de la liste.");
      return;
    }
  } else {
    const listN = LISTE_MOTS_FRANCAIS.map(w => normalizeText(w));
    if (!listN.includes(entryN)){
      setDefisFeedback("err", "Mot absent de la liste.");
      return;
    }

    if (r.type === "words_letter" && r.letter){
      if (!entryN.startsWith(normalizeText(r.letter))){
        setDefisFeedback("err", `Le mot doit commencer par "${r.letter}".`);
        return;
      }
    }

    if (r.type === "words_prefix" && r.prefix){
      if (!entryN.startsWith(normalizeText(r.prefix))){
        setDefisFeedback("err", `Le mot doit commencer par "${r.prefix.toUpperCase()}".`);
        return;
      }
    }

    if (r.type === "words_minlen" && r.minLen){
      if (entryN.length < r.minLen){
        setDefisFeedback("err", `Le mot doit avoir au moins ${r.minLen} lettres.`);
        return;
      }
    }
  }

  // OK
  currentRoundFound.push(entryN);
  addDefisFound(raw);

  setDefisFeedback("ok", "✅ Valide !");
  defisInput.value = "";
  updateDefisProgress();

  // auto-finish
  const goal = Number(defisGoal.textContent || 0);
  if (goal > 0 && currentRoundFound.length >= goal){
    setDefisFeedback("ok", "🎉 Objectif atteint ! Clique sur “Round suivant”.");
  }

  defisInput.focus();
}
