const inputGroup = document.getElementById("input-group");
const input = document.getElementById("input");
const display = document.getElementById("sentence");
const counter = document.getElementById("counter");
const newBtn = document.getElementById("new-text");
const wordList = document.getElementById("word-list");
const wordListContainer = document.getElementById("word-list-container");
const progressBar = document.getElementById("progress-bar");
const langSelect = document.getElementById("lang-select");
const aboutSection = document.getElementById("about");
const wordCount = document.getElementById("word-count");

let sentences = [];
let sentenceWords = [];   // words of current sentence
let index = 0;
let selectedIndices = new Set();
let tableRows = [];       // {indices: number[], tr: HTMLElement} — current sentence only
let currentLang = 'en';

// ── Language config ───────────────────────────────────────────────────────────
// Abbreviations whose trailing period should NOT end a sentence.
// Using ONE DOT LEADER (U+2024) as a safe placeholder.
const ABBREV_RE = {
  en: /(Mr|Mrs|Ms|Dr|Prof|St|vs|No|Vol|Jr|Sr|Rev|Lt|Col|Capt|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./g,
  de: /(Hr|Fr|Dr|Prof|Str|Nr|Tel|Kap|Abs|Anm|Bd|Jg|Jh|Mrd|Mio|usw|bzw|ggf|inkl|evtl|ca)\./g,
  fr: /(M|Mme|Mlle|Dr|Prof|St|fig|vol|no|p)\./g,
  es: /(Sr|Sra|Srta|Dr|Dra|Prof|Ud|Uds|pág|vol|núm|art|cap)\./g,
  it: /(Sig|Dott|Prof|pag|vol|cap|art|fig)\./g,
  ru: /(г|р|д|кв|тел|руб|коп|млн|млрд|тыс)\./g,
};

function splitIntoSentences(text) {
  const re = ABBREV_RE[currentLang] || ABBREV_RE.en;
  const safe = text.replace(re, (m) => m.slice(0, -1) + '\u2024');
  const chunks = safe.match(/[^.!?]+[.!?]+\s*['"'"'»«›‹]*/g);
  return (chunks || [])
    .map(s => s.replace(/\u2024/g, '.').trim())
    .filter(s => s.length > 0);
}

// ── Word normalization ────────────────────────────────────────────────────────
function normalizeWord(raw, isFirstInSentence) {
  const clean = raw.replace(/[.,\/#!$%\^&\*;:{}=_`~()«»'"'"‹›¿¡]/g, "");

  if (currentLang === 'de') {
    // German: capitalized mid-sentence = noun → preserve case
    return clean;
  }
  if (currentLang === 'ru') {
    // Russian: lowercase everything (no grammatical capitalisation)
    return clean.toLowerCase();
  }
  // Default (en/fr/es/it): lowercase unless acronym or mid-sentence proper noun
  const isAllCaps = clean === clean.toUpperCase() && /[A-Z]/.test(clean);
  const isMidCap = !isFirstInSentence && /^[A-Z\u00C0-\u00DC]/.test(clean);
  return (isAllCaps || isMidCap) ? clean : clean.toLowerCase();
}

// ── Group helpers ─────────────────────────────────────────────────────────────
function getGroups(indexSet) {
  const sorted = [...indexSet].sort((a, b) => a - b);
  const groups = [];
  let cur = [];
  for (const i of sorted) {
    if (cur.length === 0 || i === cur[cur.length - 1] + 1) {
      cur.push(i);
    } else {
      groups.push(cur);
      cur = [i];
    }
  }
  if (cur.length > 0) groups.push(cur);
  return groups;
}

function groupKey(indices) { return indices.join(','); }

// ── Context builders ──────────────────────────────────────────────────────────
function buildContext(indices) {
  const start = Math.max(0, indices[0] - 10);
  const end = Math.min(sentenceWords.length, indices[indices.length - 1] + 11);
  const selectedSet = new Set(indices);
  const html = sentenceWords.slice(start, end).map((word, i) =>
    selectedSet.has(start + i) ? `<strong>${word}</strong>` : word
  ).join(' ');
  return (start > 0 ? '…' : '') + html + (end < sentenceWords.length ? '…' : '');
}

function buildContextMarkdown(indices) {
  const start = Math.max(0, indices[0] - 10);
  const end = Math.min(sentenceWords.length, indices[indices.length - 1] + 11);
  const selectedSet = new Set(indices);
  const parts = sentenceWords.slice(start, end).map((word, i) =>
    selectedSet.has(start + i) ? `**${word}**` : word
  );
  return (start > 0 ? '… ' : '') + parts.join(' ') + (end < sentenceWords.length ? ' …' : '');
}

// ── Table row ─────────────────────────────────────────────────────────────────
function buildTableRow(indices) {
  const phrase = indices.map(i => normalizeWord(sentenceWords[i], i === 0)).join(' ');
  const contextHtml = buildContext(indices);
  const contextMd = buildContextMarkdown(indices);

  const tr = document.createElement("tr");
  tr.dataset.word = phrase;
  tr.dataset.contextMd = contextMd;
  tr.innerHTML = `
    <td class="word-cell">${phrase}</td>
    <td>${contextHtml}</td>
    <td><input type="text" placeholder="Translation…" /></td>
  `;

  tr.querySelector(".word-cell").onclick = () => {
    indices.forEach(i => selectedIndices.delete(i));
    tableRows = tableRows.filter(r => r.tr !== tr);
    tr.remove();
    renderDisplay();
    syncWordListVisibility();
  };

  return tr;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderDisplay() {
  const parts = [];
  let i = 0;
  while (i < sentenceWords.length) {
    if (selectedIndices.has(i)) {
      const spans = [];
      while (i < sentenceWords.length && selectedIndices.has(i)) {
        spans.push(`<span class="clickable-word" data-idx="${i}">${sentenceWords[i]}</span>`);
        i++;
      }
      parts.push(`<span class="underlined-group">${spans.join(' ')}</span>`);
    } else {
      parts.push(`<span class="clickable-word" data-idx="${i}">${sentenceWords[i]}</span>`);
      i++;
    }
  }
  display.innerHTML = parts.join(' ');
}

function syncTable() {
  const newGroups = getGroups(selectedIndices);
  const newKeys = new Set(newGroups.map(groupKey));

  tableRows = tableRows.filter(({ indices, tr }) => {
    if (!newKeys.has(groupKey(indices))) { tr.remove(); return false; }
    return true;
  });

  const existingKeys = new Set(tableRows.map(r => groupKey(r.indices)));
  for (const group of newGroups) {
    if (!existingKeys.has(groupKey(group))) {
      const tr = buildTableRow(group);
      wordList.appendChild(tr);
      tableRows.push({ indices: group, tr });
    }
  }

  syncWordListVisibility();
}

function syncWordListVisibility() {
  const count = wordList.children.length;
  wordListContainer.classList.toggle("hidden", count === 0);
  wordCount.textContent = count > 0 ? count : '';
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function updateProgress() {
  if (sentences.length === 0) {
    progressBar.style.width = '0%';
    return;
  }
  progressBar.style.width = `${((index + 1) / sentences.length) * 100}%`;
}

// ── Display update ────────────────────────────────────────────────────────────
function updateDisplay() {
  selectedIndices.clear();
  tableRows = [];

  if (sentences.length > 0) {
    sentenceWords = sentences[index].trim().split(/\s+/).filter(w => w.length > 0);
    renderDisplay();
    counter.innerText = `${index + 1} / ${sentences.length}`;
  } else {
    sentenceWords = [];
    display.innerText = "Paste your text below to start.";
    counter.innerText = "0 / 0";
  }
  updateProgress();
}

function acceptText(chunks) {
  sentences = chunks;
  if (sentences.length > 0) {
    index = 0;
    updateDisplay();
    inputGroup.classList.add("hidden");
    if (newBtn) newBtn.classList.remove("hidden");
    aboutSection.classList.add("hidden");
  }
}

// ── Export ────────────────────────────────────────────────────────────────────
function getExportRows() {
  return Array.from(wordList.querySelectorAll('tr')).map(tr => ({
    word: tr.dataset.word || tr.querySelector('.word-cell')?.textContent || '',
    context: tr.dataset.contextMd || '',
    translation: tr.querySelector('input')?.value || '',
  }));
}

function formatExportRow({ word, context, translation }) {
  const parts = [word, context];
  if (translation) parts.push(translation);
  return parts.join(' - ');
}

document.getElementById('export-anki').onclick = () => {
  const rows = getExportRows();
  if (rows.length === 0) return;
  const content = rows.map(formatExportRow).join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'one-sentence-reader.txt';
  a.click();
  URL.revokeObjectURL(url);
};

function formatClipboardRow({ word, context, translation }) {
  const plainContext = context.replace(/\*\*/g, '');
  const parts = [`**${word}**`, plainContext];
  if (translation) parts.push(translation);
  return parts.join(' - ');
}

document.getElementById('copy-words').onclick = () => {
  const rows = getExportRows();
  if (rows.length === 0) return;
  navigator.clipboard.writeText(rows.map(formatClipboardRow).join('\n'));
};

// ── Event listeners ───────────────────────────────────────────────────────────
display.addEventListener('click', (e) => {
  const wordEl = e.target.closest('.clickable-word');
  if (!wordEl) return;
  const idx = parseInt(wordEl.dataset.idx);
  if (isNaN(idx)) return;

  if (selectedIndices.has(idx)) {
    selectedIndices.delete(idx);
  } else {
    selectedIndices.add(idx);
  }

  renderDisplay();
  syncTable();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft' && index > 0) { index--; updateDisplay(); }
  if (e.key === 'ArrowRight' && index < sentences.length - 1) { index++; updateDisplay(); }
});

langSelect.addEventListener('change', () => {
  currentLang = langSelect.value;
});

// Font toggle
document.querySelectorAll('.font-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.body.dataset.font = btn.dataset.font;
  });
});

document.getElementById("accept").onclick = () => {
  acceptText(splitIntoSentences(input.value));
};

document.getElementById("accept-paragraphs").onclick = () => {
  const chunks = input.value
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  acceptText(chunks);
};

if (newBtn) {
  newBtn.onclick = () => {
    inputGroup.classList.remove("hidden");
    newBtn.classList.add("hidden");
    aboutSection.classList.remove("hidden");
    input.focus();
  };
}

document.getElementById("refresh").onclick = () => {
  input.value = "";
  sentences = [];
  index = 0;
  selectedIndices.clear();
  tableRows = [];
  wordList.innerHTML = "";
  syncWordListVisibility();
  updateDisplay();
  inputGroup.classList.remove("hidden");
  if (newBtn) newBtn.classList.add("hidden");
  aboutSection.classList.remove("hidden");
};

document.getElementById("prev").onclick = () => {
  if (index > 0) { index--; updateDisplay(); }
};
document.getElementById("next").onclick = () => {
  if (index < sentences.length - 1) { index++; updateDisplay(); }
};

// Init
syncWordListVisibility();
