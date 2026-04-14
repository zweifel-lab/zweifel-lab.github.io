const inputGroup = document.getElementById("input-group");
const input = document.getElementById("input");
const display = document.getElementById("sentence");
const counter = document.getElementById("counter");
const newBtn = document.getElementById("new-text");
const wordList = document.getElementById("word-list");
const wordListContainer = document.getElementById("word-list-container");

let sentences = [];
let sentenceWords = [];   // words of current sentence
let index = 0;
let selectedIndices = new Set();
let tableRows = [];       // {indices: number[], tr: HTMLElement} — current sentence only

syncWordListVisibility();

function syncWordListVisibility() {
  wordListContainer.classList.toggle("hidden", wordList.children.length === 0);
}

function normalizeWord(raw, isFirstInSentence) {
  const clean = raw.replace(/[.,\/#!$%\^&\*;:{}=_`~()«»'"'"‹›]/g, "");
  const isAllCaps = clean === clean.toUpperCase() && /[A-Z]/.test(clean);
  const isMidCap = !isFirstInSentence && /^[A-Z\u00C0-\u00DC]/.test(clean);
  return (isAllCaps || isMidCap) ? clean : clean.toLowerCase();
}

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

function buildContext(indices) {
  const start = Math.max(0, indices[0] - 10);
  const end = Math.min(sentenceWords.length, indices[indices.length - 1] + 11);
  const selectedSet = new Set(indices);
  const html = sentenceWords.slice(start, end).map((word, i) =>
    selectedSet.has(start + i) ? `<strong>${word}</strong>` : word
  ).join(' ');
  return (start > 0 ? '…' : '') + html + (end < sentenceWords.length ? '…' : '');
}

function buildTableRow(indices) {
  const phrase = indices.map(i => normalizeWord(sentenceWords[i], i === 0)).join(' ');
  const contextHtml = buildContext(indices);

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="word-cell">${phrase}</td>
    <td>${contextHtml}</td>
    <td><input type="text" placeholder="Translation…" /></td>
  `;

  // Word-cell click: remove entire group (existing "correct" table behavior)
  tr.querySelector(".word-cell").onclick = () => {
    indices.forEach(i => selectedIndices.delete(i));
    tableRows = tableRows.filter(r => r.tr !== tr);
    tr.remove();
    renderDisplay();
    syncWordListVisibility();
  };

  return tr;
}

function renderDisplay() {
  const parts = [];
  let i = 0;
  while (i < sentenceWords.length) {
    if (selectedIndices.has(i)) {
      // Wrap consecutive selected words in one span so underline is continuous
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

  // Remove rows whose group no longer exists
  tableRows = tableRows.filter(({ indices, tr }) => {
    if (!newKeys.has(groupKey(indices))) { tr.remove(); return false; }
    return true;
  });

  // Add rows for new groups
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

// Event delegation — single listener handles all word clicks
display.addEventListener('click', (e) => {
  const wordEl = e.target.closest('.clickable-word');
  if (!wordEl) return;
  const idx = parseInt(wordEl.dataset.idx);
  if (isNaN(idx)) return;

  // Toggle only this word; deselect removes just this word from its group
  if (selectedIndices.has(idx)) {
    selectedIndices.delete(idx);
  } else {
    selectedIndices.add(idx);
  }

  renderDisplay();
  syncTable();
});

function updateDisplay() {
  selectedIndices.clear();
  tableRows = [];

  if (sentences.length > 0) {
    sentenceWords = sentences[index].trim().split(' ');
    renderDisplay();
    counter.innerText = `${index + 1} / ${sentences.length}`;
  } else {
    sentenceWords = [];
    display.innerText = "Paste your text below to start.";
    counter.innerText = "0 / 0";
  }
}

function acceptText(chunks) {
  sentences = chunks;
  if (sentences.length > 0) {
    index = 0;
    updateDisplay();
    inputGroup.classList.add("hidden");
    if (newBtn) newBtn.classList.remove("hidden");
  }
}

document.getElementById("accept").onclick = () => {
  const chunks = input.value
    .match(/[^.!?]+[.!?]+\s*['"'"'»«›‹]*/g)
    ?.map((s) => s.trim())
    .filter((s) => s.length > 0) ?? [];
  acceptText(chunks);
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
};

document.getElementById("prev").onclick = () => {
  if (index > 0) { index--; updateDisplay(); }
};
document.getElementById("next").onclick = () => {
  if (index < sentences.length - 1) { index++; updateDisplay(); }
};
