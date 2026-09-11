// assets/logic.js
// Pure spelling-game logic — no DOM access. Loaded as a plain <script> tag in
// the browser (exposes globals) and required directly from Node tests.

function shuffleWords(words, randomFn) {
  randomFn = randomFn || Math.random;
  var result = words.slice();
  for (var i = result.length - 1; i > 0; i--) {
    var j = Math.floor(randomFn() * (i + 1));
    var tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function checkAnswer(input, target) {
  if (typeof input !== 'string' || typeof target !== 'string') return false;
  return input.trim().toLowerCase() === target.trim().toLowerCase();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shuffleWords: shuffleWords,
    checkAnswer: checkAnswer,
  };
}
