// assets/logic.js
// Pure spelling-game logic — no DOM access. Loaded as a plain <script> tag in
// the browser (exposes globals) and required directly from Node tests.
// Browser: exposes bare global functions. Node: exports the same functions flat via module.exports.

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

var VOWELS = ['a', 'e', 'i', 'o', 'u'];

function swapAdjacentLetters(word, randomFn) {
  if (word.length < 2) return null;
  var i = Math.floor(randomFn() * (word.length - 1));
  var chars = word.split('');
  var tmp = chars[i];
  chars[i] = chars[i + 1];
  chars[i + 1] = tmp;
  return chars.join('');
}

function dropLetter(word, randomFn) {
  if (word.length < 2) return null;
  var i = Math.floor(randomFn() * word.length);
  return word.slice(0, i) + word.slice(i + 1);
}

function duplicateLetter(word, randomFn) {
  var i = Math.floor(randomFn() * word.length);
  return word.slice(0, i + 1) + word[i] + word.slice(i + 1);
}

function swapVowel(word, randomFn) {
  var vowelIndexes = [];
  for (var i = 0; i < word.length; i++) {
    if (VOWELS.indexOf(word[i]) !== -1) vowelIndexes.push(i);
  }
  if (vowelIndexes.length === 0) return null;
  var idx = vowelIndexes[Math.floor(randomFn() * vowelIndexes.length)];
  var otherVowels = VOWELS.filter(function (v) { return v !== word[idx]; });
  var replacement = otherVowels[Math.floor(randomFn() * otherVowels.length)];
  return word.slice(0, idx) + replacement + word.slice(idx + 1);
}

function generateDistractors(word, count, randomFn) {
  randomFn = randomFn || Math.random;
  count = count || 3;
  var mutators = [swapAdjacentLetters, dropLetter, duplicateLetter, swapVowel];
  var seen = {};
  seen[word.toLowerCase()] = true;
  var results = [];
  var attempts = 0;
  var maxAttempts = count * 25;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    var mutator = mutators[Math.floor(randomFn() * mutators.length)];
    var candidate = mutator(word, randomFn);
    if (!candidate) continue;
    var key = candidate.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    results.push(candidate);
  }

  return results;
}

function scrambleLetters(word, randomFn) {
  randomFn = randomFn || Math.random;
  var original = word.split('');
  if (original.length < 2) return original;

  var scrambled = original.slice();
  var attempts = 0;
  do {
    for (var i = scrambled.length - 1; i > 0; i--) {
      var j = Math.floor(randomFn() * (i + 1));
      var tmp = scrambled[i];
      scrambled[i] = scrambled[j];
      scrambled[j] = tmp;
    }
    attempts++;
  } while (scrambled.join('') === original.join('') && attempts < 20);

  return scrambled;
}

function tallyScore(results) {
  var correct = results.filter(function (r) { return r === true; }).length;
  return { correct: correct, total: results.length };
}

function addDays(dateStr, delta) {
  var d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function updateStreak(streak, todayDateStr) {
  streak = streak || { count: 0, lastPlayedDate: null };
  if (streak.lastPlayedDate === todayDateStr) {
    return { count: streak.count, lastPlayedDate: todayDateStr };
  }
  var yesterday = addDays(todayDateStr, -1);
  var newCount = (streak.lastPlayedDate === yesterday) ? streak.count + 1 : 1;
  return { count: newCount, lastPlayedDate: todayDateStr };
}

function toLocalDateString(date) {
  var month = date.getMonth() + 1;
  var day = date.getDate();
  return date.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shuffleWords: shuffleWords,
    checkAnswer: checkAnswer,
    generateDistractors: generateDistractors,
    scrambleLetters: scrambleLetters,
    tallyScore: tallyScore,
    updateStreak: updateStreak,
    toLocalDateString: toLocalDateString,
  };
}
