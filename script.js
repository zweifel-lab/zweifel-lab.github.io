const inputGroup = document.getElementById("input-group");
const input = document.getElementById("input");
const display = document.getElementById("sentence");
const counter = document.getElementById("counter");
const newBtn = document.getElementById("new-text");
const wordList = document.getElementById("word-list");

let sentences = [];
let index = 0;

function updateDisplay() {
  if (sentences.length > 0) {
    const rawSentence = sentences[index].trim() + ".";

    display.innerHTML = rawSentence
      .split(" ")
      .map(
        (word) =>
          `<span class="clickable-word" style="cursor:pointer">${word}</span>`,
      )
      .join(" ");

    document.querySelectorAll(".clickable-word").forEach((wordEl) => {
      wordEl.onclick = () => {
        const cleanWord = wordEl.innerText.replace(
          /[.,\/#!$%\^&\*;:{}=\-_`~()]/g,
          "",
        );
        // Toggle underline and add to list
        wordEl.classList.toggle("underlined");
        if (wordEl.classList.contains("underlined")) {
          addWordToList(cleanWord, wordEl);
        }
      };
    });

    counter.innerText = `${index + 1} / ${sentences.length}`;
  } else {
    display.innerText = "Paste your text below to start.";
    counter.innerText = "0 / 0";
  }
}

function addWordToList(word, originalEl) {
  const li = document.createElement("li");
  li.innerText = word;
  li.style.cursor = "pointer";
  li.onclick = () => {
    li.remove();
    if (originalEl) originalEl.classList.remove("underlined");
  };
  wordList.appendChild(li);
}

document.getElementById("accept").onclick = () => {
  sentences = input.value
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length > 0) {
    index = 0;
    updateDisplay();
    inputGroup.classList.add("hidden");
    if (newBtn) newBtn.classList.remove("hidden");
  }
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
  wordList.innerHTML = "";
  updateDisplay();
  inputGroup.classList.remove("hidden");
  if (newBtn) newBtn.classList.add("hidden");
};

document.getElementById("prev").onclick = () => {
  if (index > 0) {
    index--;
    updateDisplay();
  }
};
document.getElementById("next").onclick = () => {
  if (index < sentences.length - 1) {
    index++;
    updateDisplay();
  }
};
