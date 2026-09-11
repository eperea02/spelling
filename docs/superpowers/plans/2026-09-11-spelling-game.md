# Spelling Practice Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, phone-friendly spelling practice game (three modes: hear-it-type-it, multiple choice, unscramble) that reads its word list from a JSON file and runs entirely client-side, deployable via GitHub Pages.

**Architecture:** Plain HTML/CSS/JS, no build step, no framework. Pure game logic lives in `assets/logic.js` (unit tested with Node's built-in test runner), localStorage access is isolated in `assets/storage.js` (also unit tested via an injected fake store), Web Speech API access is isolated in `assets/speech.js` (browser-only, manually verified), and `script.js` is the only file that touches the DOM, wiring the other three together. This mirrors the existing `workouts` repo's `assets/logic.js` + `script.js` split.

**Tech Stack:** Vanilla JS (ES5-style function declarations, `var`, dual `module.exports`/global-script export pattern — see `workouts/assets/logic.js` for the exact convention), Node's built-in `node:test` + `node:assert` for unit tests, `python3 -m http.server` for local manual verification, GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-09-11-spelling-game-design.md`

## Global Constraints

- No build step — files are served as-is by GitHub Pages from the repo root.
- No external dictionary/API calls — multiple-choice distractors are generated algorithmically from the real word.
- No audio files — speech uses the browser's `SpeechSynthesis` API only, with graceful degradation if unsupported.
- No accounts/backend — all progress persists in `localStorage` only, schema-versioned.
- `data/words.json` is hand-edited for weekly updates; no in-app word entry UI.
- Pure logic files use CommonJS `module.exports` guarded by `typeof module !== 'undefined'` so the same file works as a browser `<script>` global and a Node `require()` target (see `workouts/assets/logic.js:1-3` and its final `if (typeof module !== 'undefined' ...)` block for the exact pattern to copy).

---

## Task 1: Word list data file + validation test

**Files:**
- Create: `data/words.json`
- Create: `tests/data.test.js`

**Interfaces:**
- Produces: `data/words.json` with shape `{ "week": string, "words": string[] }`, fetched by `script.js` in Task 8.

- [ ] **Step 1: Write the failing test**

```js
// tests/data.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const raw = fs.readFileSync(path.join(__dirname, '../data/words.json'), 'utf8');

test('words.json parses as JSON', () => {
  assert.doesNotThrow(() => JSON.parse(raw));
});

test('words.json has a non-empty week label', () => {
  const data = JSON.parse(raw);
  assert.strictEqual(typeof data.week, 'string');
  assert.ok(data.week.length > 0);
});

test('words.json has a non-empty array of lowercase word strings', () => {
  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data.words));
  assert.ok(data.words.length > 0);
  data.words.forEach((w) => {
    assert.strictEqual(typeof w, 'string');
    assert.ok(w.length > 0);
    assert.strictEqual(w, w.toLowerCase());
  });
});

test('words.json has no duplicate words', () => {
  const data = JSON.parse(raw);
  const unique = new Set(data.words);
  assert.strictEqual(unique.size, data.words.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/data.test.js`
Expected: FAIL — `data/words.json` does not exist yet (ENOENT).

- [ ] **Step 3: Create the word list**

```json
{
  "week": "2026-09-14",
  "words": [
    "because",
    "friend",
    "believe",
    "although",
    "separate",
    "different",
    "surprise",
    "beautiful",
    "favorite",
    "important"
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/data.test.js`
Expected: PASS (4/4 tests)

- [ ] **Step 5: Commit**

```bash
git add data/words.json tests/data.test.js
git commit -m "Add weekly word list with validation test"
```

---

## Task 2: Round setup and answer-checking logic

**Files:**
- Create: `assets/logic.js`
- Create: `tests/logic.test.js`

**Interfaces:**
- Produces: `shuffleWords(words, randomFn)` → new shuffled array (does not mutate input); `checkAnswer(input, target)` → boolean, case-insensitive and whitespace-trimmed.
- Consumed by: Task 3 (multiple choice), Task 4 (unscramble), Task 8-10 (script.js).

- [ ] **Step 1: Write the failing tests**

```js
// tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const { shuffleWords, checkAnswer } = require('../assets/logic.js');

test('shuffleWords returns a new array with the same elements', () => {
  const words = ['cat', 'dog', 'bird'];
  const result = shuffleWords(words, () => 0);
  assert.notStrictEqual(result, words);
  assert.deepStrictEqual([...result].sort(), [...words].sort());
});

test('shuffleWords does not mutate the input array', () => {
  const words = ['cat', 'dog', 'bird'];
  const copy = [...words];
  shuffleWords(words, () => 0.5);
  assert.deepStrictEqual(words, copy);
});

test('shuffleWords is deterministic given a fixed randomFn', () => {
  const words = ['a', 'b', 'c', 'd'];
  const result = shuffleWords(words, () => 0);
  // Fisher-Yates with randomFn always 0 always swaps result[i] with result[0]
  // for i = n-1 downTo 1, which is NOT a full reversal — verified: ['b','c','d','a']
  assert.deepStrictEqual(result, ['b', 'c', 'd', 'a']);
});

test('checkAnswer matches case-insensitively', () => {
  assert.strictEqual(checkAnswer('Because', 'because'), true);
  assert.strictEqual(checkAnswer('BECAUSE', 'because'), true);
});

test('checkAnswer trims surrounding whitespace', () => {
  assert.strictEqual(checkAnswer('  because  ', 'because'), true);
});

test('checkAnswer rejects wrong spelling', () => {
  assert.strictEqual(checkAnswer('becuase', 'because'), false);
});

test('checkAnswer rejects non-string input safely', () => {
  assert.strictEqual(checkAnswer(undefined, 'because'), false);
  assert.strictEqual(checkAnswer(null, 'because'), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/logic.test.js`
Expected: FAIL — `assets/logic.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/logic.test.js`
Expected: PASS (7/7 tests)

- [ ] **Step 5: Commit**

```bash
git add assets/logic.js tests/logic.test.js
git commit -m "Add word shuffle and answer-checking logic"
```

---

## Task 3: Multiple-choice distractor generation

**Files:**
- Modify: `assets/logic.js` (append distractor functions before the `module.exports` block)
- Modify: `tests/logic.test.js` (append new tests)

**Interfaces:**
- Consumes: nothing from other files.
- Produces: `generateDistractors(word, count, randomFn)` → array of up to `count` unique lowercase strings, never containing `word` itself. Consumed by Task 9 (multiple choice mode).

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js` (update the `require` line to include `generateDistractors`):

```js
const { shuffleWords, checkAnswer, generateDistractors } = require('../assets/logic.js');
```

```js
test('generateDistractors never includes the real word', () => {
  const distractors = generateDistractors('friend', 3, Math.random);
  distractors.forEach((d) => assert.notStrictEqual(d.toLowerCase(), 'friend'));
});

test('generateDistractors returns unique options with no duplicates', () => {
  const distractors = generateDistractors('beautiful', 3, Math.random);
  const unique = new Set(distractors.map((d) => d.toLowerCase()));
  assert.strictEqual(unique.size, distractors.length);
});

test('generateDistractors returns up to count distractors for a typical word', () => {
  const distractors = generateDistractors('important', 3, Math.random);
  assert.ok(distractors.length > 0);
  assert.ok(distractors.length <= 3);
});

test('generateDistractors degrades gracefully for a very short word without crashing', () => {
  assert.doesNotThrow(() => generateDistractors('a', 3, Math.random));
  const distractors = generateDistractors('a', 3, Math.random);
  assert.ok(Array.isArray(distractors));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/logic.test.js`
Expected: FAIL — `generateDistractors` is not exported/defined.

- [ ] **Step 3: Write the implementation**

Insert into `assets/logic.js`, before the `if (typeof module !== 'undefined' ...)` block:

```js
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
```

Then update the `module.exports` block (added in Task 2) to also expose `generateDistractors`:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shuffleWords: shuffleWords,
    checkAnswer: checkAnswer,
    generateDistractors: generateDistractors,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/logic.test.js`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 5: Commit**

```bash
git add assets/logic.js tests/logic.test.js
git commit -m "Add multiple-choice distractor generation"
```

---

## Task 4: Letter-scramble generation for unscramble mode

**Files:**
- Modify: `assets/logic.js` (append before `module.exports`)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Produces: `scrambleLetters(word, randomFn)` → array of single-character strings, order different from the original split whenever mathematically possible. Consumed by Task 10 (unscramble mode).

- [ ] **Step 1: Write the failing tests**

Update the `require` line:

```js
const { shuffleWords, checkAnswer, generateDistractors, scrambleLetters } = require('../assets/logic.js');
```

```js
test('scrambleLetters returns the same letters as the original word', () => {
  const result = scrambleLetters('friend', Math.random);
  assert.deepStrictEqual(result.slice().sort(), 'friend'.split('').sort());
});

test('scrambleLetters returns a different order than the original for a typical word', () => {
  // NOT 0.9: for a 9-letter word, floor(0.9*(i+1)) === i at every step (verified),
  // producing the identity permutation — the shuffle never actually swaps anything.
  const result = scrambleLetters('beautiful', () => 0.1);
  assert.notDeepStrictEqual(result, 'beautiful'.split(''));
});

test('scrambleLetters handles a 1-letter word without crashing', () => {
  const result = scrambleLetters('a', Math.random);
  assert.deepStrictEqual(result, ['a']);
});

test('scrambleLetters does not infinite-loop on all-identical letters', () => {
  const result = scrambleLetters('aaa', Math.random);
  assert.deepStrictEqual(result.slice().sort(), ['a', 'a', 'a']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/logic.test.js`
Expected: FAIL — `scrambleLetters` is not exported/defined.

- [ ] **Step 3: Write the implementation**

Insert into `assets/logic.js`, before the `module.exports` block:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/logic.test.js`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 5: Update the exports and commit**

Update the `module.exports` block in `assets/logic.js` (already exporting `shuffleWords`, `checkAnswer`, `generateDistractors` as of Task 3) to also include `scrambleLetters`:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shuffleWords: shuffleWords,
    checkAnswer: checkAnswer,
    generateDistractors: generateDistractors,
    scrambleLetters: scrambleLetters,
  };
}
```

```bash
git add assets/logic.js tests/logic.test.js
git commit -m "Add letter-scramble generation for unscramble mode"
```

---

## Task 5: Scoring and streak logic

**Files:**
- Modify: `assets/logic.js` (append before `module.exports`, update `module.exports`)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Produces: `tallyScore(results)` → `{ correct: number, total: number }`; `updateStreak(streak, todayDateStr)` → `{ count: number, lastPlayedDate: string }`, where `streak` is `{ count, lastPlayedDate } | null`.
- Consumed by: Task 11 (results screen + progress wiring).

- [ ] **Step 1: Write the failing tests**

Update the `require` line:

```js
const {
  shuffleWords, checkAnswer, generateDistractors, scrambleLetters,
  tallyScore, updateStreak,
} = require('../assets/logic.js');
```

```js
test('tallyScore counts correct answers out of total', () => {
  assert.deepStrictEqual(tallyScore([true, false, true, true]), { correct: 3, total: 4 });
});

test('tallyScore handles an all-wrong round', () => {
  assert.deepStrictEqual(tallyScore([false, false]), { correct: 0, total: 2 });
});

test('tallyScore handles an empty round', () => {
  assert.deepStrictEqual(tallyScore([]), { correct: 0, total: 0 });
});

test('updateStreak starts at 1 with no prior streak', () => {
  const result = updateStreak(null, '2026-09-11');
  assert.deepStrictEqual(result, { count: 1, lastPlayedDate: '2026-09-11' });
});

test('updateStreak does not increment for a second play on the same day', () => {
  const streak = { count: 3, lastPlayedDate: '2026-09-11' };
  const result = updateStreak(streak, '2026-09-11');
  assert.deepStrictEqual(result, { count: 3, lastPlayedDate: '2026-09-11' });
});

test('updateStreak increments for the very next day', () => {
  const streak = { count: 3, lastPlayedDate: '2026-09-10' };
  const result = updateStreak(streak, '2026-09-11');
  assert.deepStrictEqual(result, { count: 4, lastPlayedDate: '2026-09-11' });
});

test('updateStreak resets to 1 after a skipped day', () => {
  const streak = { count: 5, lastPlayedDate: '2026-09-08' };
  const result = updateStreak(streak, '2026-09-11');
  assert.deepStrictEqual(result, { count: 1, lastPlayedDate: '2026-09-11' });
});

test('updateStreak handles a month boundary correctly', () => {
  const streak = { count: 2, lastPlayedDate: '2026-08-31' };
  const result = updateStreak(streak, '2026-09-01');
  assert.deepStrictEqual(result, { count: 3, lastPlayedDate: '2026-09-01' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/logic.test.js`
Expected: FAIL — `tallyScore`/`updateStreak` are not exported/defined.

- [ ] **Step 3: Write the implementation**

Insert into `assets/logic.js`, before the `module.exports` block:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/logic.test.js`
Expected: PASS (all tests, including the 8 new ones)

- [ ] **Step 5: Update exports and commit**

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shuffleWords: shuffleWords,
    checkAnswer: checkAnswer,
    generateDistractors: generateDistractors,
    scrambleLetters: scrambleLetters,
    tallyScore: tallyScore,
    updateStreak: updateStreak,
  };
}
```

```bash
git add assets/logic.js tests/logic.test.js
git commit -m "Add scoring and day-streak logic"
```

---

## Task 6: Progress storage (localStorage wrapper)

**Files:**
- Create: `assets/storage.js`
- Create: `tests/storage.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all attached to global `Storage` in the browser, and via `module.exports` in Node): `defaultProgress()` → `{ schemaVersion, bestScores: {}, streak: { count: 0, lastPlayedDate: null } }`; `loadProgress(store)` → progress object (falls back to `defaultProgress()` on missing/corrupt data); `saveProgress(progress, store)` → boolean success; `recordBestScore(progress, week, mode, score)` → new progress object with `bestScores[week][mode]` set to `max(existing, score)`. `store` is an object with `getItem(key)`/`setItem(key, value)` — in the browser this is `window.localStorage`, in tests it's an injected fake.
- Consumed by: Task 8 (bootstrap/home screen) and Task 11 (results screen).

- [ ] **Step 1: Write the failing tests**

```js
// tests/storage.test.js
const test = require('node:test');
const assert = require('node:assert');
const { defaultProgress, loadProgress, saveProgress, recordBestScore, STORAGE_KEY } = require('../assets/storage.js');

function fakeStore(initial) {
  var data = Object.assign({}, initial);
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = value; },
    _dump: function () { return data; },
  };
}

test('defaultProgress has empty bestScores and a zeroed streak', () => {
  const progress = defaultProgress();
  assert.deepStrictEqual(progress.bestScores, {});
  assert.deepStrictEqual(progress.streak, { count: 0, lastPlayedDate: null });
});

test('loadProgress returns defaults when store is empty', () => {
  const store = fakeStore({});
  assert.deepStrictEqual(loadProgress(store), defaultProgress());
});

test('loadProgress returns defaults when stored JSON is corrupt', () => {
  var store = fakeStore({});
  store.setItem(STORAGE_KEY, '{not valid json');
  assert.deepStrictEqual(loadProgress(store), defaultProgress());
});

test('loadProgress returns defaults when schemaVersion does not match', () => {
  var store = fakeStore({});
  store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 999, bestScores: {}, streak: {} }));
  assert.deepStrictEqual(loadProgress(store), defaultProgress());
});

test('saveProgress then loadProgress round-trips', () => {
  var store = fakeStore({});
  var progress = recordBestScore(defaultProgress(), '2026-09-14', 'hear-type', 6);
  saveProgress(progress, store);
  assert.deepStrictEqual(loadProgress(store), progress);
});

test('recordBestScore only raises the score, never lowers it', () => {
  var progress = recordBestScore(defaultProgress(), '2026-09-14', 'hear-type', 6);
  var lowered = recordBestScore(progress, '2026-09-14', 'hear-type', 3);
  assert.strictEqual(lowered.bestScores['2026-09-14']['hear-type'], 6);
  var raised = recordBestScore(progress, '2026-09-14', 'hear-type', 9);
  assert.strictEqual(raised.bestScores['2026-09-14']['hear-type'], 9);
});

test('recordBestScore does not mutate the input progress object', () => {
  var progress = defaultProgress();
  recordBestScore(progress, '2026-09-14', 'hear-type', 6);
  assert.deepStrictEqual(progress.bestScores, {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/storage.test.js`
Expected: FAIL — `assets/storage.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```js
// assets/storage.js
// localStorage access, isolated from the rest of the app. Loaded as a plain
// <script> tag in the browser (exposes a global `Storage` object) and
// required directly from Node tests.

var STORAGE_KEY = 'spelling-progress-v1';
var SCHEMA_VERSION = 1;

function defaultProgress() {
  return {
    schemaVersion: SCHEMA_VERSION,
    bestScores: {},
    streak: { count: 0, lastPlayedDate: null },
  };
}

function isValidProgress(parsed) {
  return !!parsed &&
    parsed.schemaVersion === SCHEMA_VERSION &&
    typeof parsed.bestScores === 'object' &&
    parsed.streak &&
    typeof parsed.streak.count === 'number';
}

function loadProgress(store) {
  if (!store) return defaultProgress();
  try {
    var raw = store.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    var parsed = JSON.parse(raw);
    return isValidProgress(parsed) ? parsed : defaultProgress();
  } catch (e) {
    return defaultProgress();
  }
}

function saveProgress(progress, store) {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch (e) {
    return false;
  }
}

function recordBestScore(progress, week, mode, score) {
  var next = JSON.parse(JSON.stringify(progress));
  if (!next.bestScores[week]) next.bestScores[week] = {};
  var prevBest = next.bestScores[week][mode] || 0;
  next.bestScores[week][mode] = Math.max(prevBest, score);
  return next;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    defaultProgress: defaultProgress,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    recordBestScore: recordBestScore,
  };
} else {
  var Storage = {
    defaultProgress: defaultProgress,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    recordBestScore: recordBestScore,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/storage.test.js`
Expected: PASS (7/7 tests)

- [ ] **Step 5: Commit**

```bash
git add assets/storage.js tests/storage.test.js
git commit -m "Add localStorage progress wrapper with schema versioning"
```

---

## Task 7: Speech wrapper (Web Speech API)

**Files:**
- Create: `assets/speech.js`

**Interfaces:**
- Produces (global `Speech` object; browser-only, not required from Node): `Speech.isSupported()` → boolean; `Speech.speak(word)` → boolean (whether speech was actually triggered); `Speech.cancel()` → void.
- Consumed by: Task 8 (hear-it-type-it), Task 9 (multiple choice).

No automated test for this file: it wraps `window.speechSynthesis`/`SpeechSynthesisUtterance`, which don't exist in Node, and the design spec calls for manual browser verification of speech behavior instead (see spec's "Testing" section). Verification happens in Task 8's manual QA step once `speak()` is wired to a button.

- [ ] **Step 1: Write the implementation**

```js
// assets/speech.js
// Wraps the browser's Web Speech API so the rest of the app never touches
// `window.speechSynthesis` directly. Browser-only — not loaded in Node tests.

var Speech = (function () {
  function isSupported() {
    return typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined';
  }

  function speak(word) {
    if (!isSupported()) return false;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function cancel() {
    if (isSupported()) window.speechSynthesis.cancel();
  }

  return { isSupported: isSupported, speak: speak, cancel: cancel };
})();
```

- [ ] **Step 2: Verify it loads without error**

Run: `node -e "fs=require('fs'); new Function(fs.readFileSync('assets/speech.js', 'utf8'))()"`
Expected: no output, no thrown error (confirms the file is syntactically valid JS; actual speech behavior is verified manually in Task 8 once buttons are wired).

- [ ] **Step 3: Commit**

```bash
git add assets/speech.js
git commit -m "Add Web Speech API wrapper"
```

---

## Task 8: Page shell, styling, and Hear-It-Type-It mode

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `script.js`

**Interfaces:**
- Consumes: `shuffleWords`, `checkAnswer` (Task 2), `Storage.loadProgress`/`Storage.saveProgress` (Task 6), `Speech.isSupported`/`Speech.speak` (Task 7), `data/words.json` (Task 1).
- Produces: the DOM element IDs and `state`/`el` module-level objects in `script.js` that Tasks 9-11 extend. Element ID contract (all referenced by later tasks): `home-screen`, `game-screen`, `results-screen`, `week-label`, `streak-display`, `load-error`, `mode-list` (buttons with `data-mode="hear-type"|"multiple-choice"|"unscramble"`, each containing a `[data-star-for]` span), `game-progress`, `feedback`, `hear-type-panel`, `hear-type-input`, `hear-type-submit`, `hear-type-hint`, `replay-audio-btn`, `multiple-choice-panel`, `mc-options`, `mc-replay-btn`, `unscramble-panel`, `unscramble-build`, `unscramble-bank`, `unscramble-reset`, `unscramble-check`, `results-score`, `results-missed`, `results-replay-btn`, `results-home-btn`.

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Spelling Practice</title>
<meta name="description" content="Practice this week's spelling words with three quick game modes." />
<link rel="stylesheet" href="styles.css" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%9D%3C/text%3E%3C/svg%3E" />
</head>
<body>

<header class="site-header">
  <div class="wrap"><span class="brand">📝 Spelling Practice</span></div>
</header>

<main class="wrap">

  <section id="home-screen" class="screen">
    <p id="week-label" class="eyebrow"></p>
    <h1>Practice This Week's Words</h1>
    <p id="streak-display" class="streak"></p>
    <p id="load-error" class="empty-state" hidden></p>
    <div id="mode-list" class="mode-list">
      <button type="button" class="mode-btn" data-mode="hear-type">
        <span class="mode-title">🔊 Hear It, Type It</span>
        <span class="mode-star" data-star-for="hear-type" hidden>⭐ Perfect!</span>
      </button>
      <button type="button" class="mode-btn" data-mode="multiple-choice">
        <span class="mode-title">🔤 Multiple Choice</span>
        <span class="mode-star" data-star-for="multiple-choice" hidden>⭐ Perfect!</span>
      </button>
      <button type="button" class="mode-btn" data-mode="unscramble">
        <span class="mode-title">🧩 Unscramble</span>
        <span class="mode-star" data-star-for="unscramble" hidden>⭐ Perfect!</span>
      </button>
    </div>
  </section>

  <section id="game-screen" class="screen" hidden>
    <p id="game-progress" class="game-progress"></p>

    <div id="hear-type-panel" class="mode-panel" hidden>
      <button type="button" id="replay-audio-btn" class="plan-btn">🔊 Replay</button>
      <p id="hear-type-hint" class="hint" hidden></p>
      <input type="text" id="hear-type-input" class="text-input" autocomplete="off" autocapitalize="off" spellcheck="false" />
      <button type="button" id="hear-type-submit" class="plan-btn">Check</button>
    </div>

    <div id="multiple-choice-panel" class="mode-panel" hidden>
      <button type="button" id="mc-replay-btn" class="plan-btn">🔊 Replay</button>
      <div id="mc-options" class="mc-options"></div>
    </div>

    <div id="unscramble-panel" class="mode-panel" hidden>
      <div id="unscramble-build" class="tile-row"></div>
      <div id="unscramble-bank" class="tile-row"></div>
      <div class="unscramble-controls">
        <button type="button" id="unscramble-reset" class="plan-btn">Reset</button>
        <button type="button" id="unscramble-check" class="plan-btn">Check</button>
      </div>
    </div>

    <p id="feedback" class="feedback" aria-live="polite"></p>
  </section>

  <section id="results-screen" class="screen" hidden>
    <h2>Round Complete!</h2>
    <p id="results-score" class="results-score"></p>
    <p id="results-missed" class="results-missed"></p>
    <div class="results-controls">
      <button type="button" id="results-replay-btn" class="plan-btn">Play Again</button>
      <button type="button" id="results-home-btn" class="plan-btn">Home</button>
    </div>
  </section>

</main>

<script src="assets/logic.js"></script>
<script src="assets/storage.js"></script>
<script src="assets/speech.js"></script>
<script src="script.js"></script>

</body>
</html>
```

- [ ] **Step 2: Write `styles.css`**

```css
:root {
  color-scheme: light;
  --bg: #fdfaf5;
  --ink: #2b2420;
  --accent: #d1552f;
  --accent-ink: #ffffff;
  --card: #ffffff;
  --border: #e6ddd0;
  --correct: #2e7d32;
  --wrong: #c62828;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.wrap { max-width: 480px; margin: 0 auto; padding: 0 16px; }

.site-header {
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.brand { font-weight: 700; font-size: 1.2rem; }

.screen { padding: 24px 0 48px; }
.screen[hidden] { display: none; }

.eyebrow { color: #8a7f70; font-size: 0.85rem; margin: 0 0 4px; }
h1 { font-size: 1.6rem; margin: 0 0 8px; }
.streak { font-size: 1rem; margin: 0 0 20px; }

.empty-state {
  background: #fff3ee;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.mode-list { display: flex; flex-direction: column; gap: 12px; }
.mode-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 18px 16px;
  font-size: 1.05rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-align: left;
}
.mode-star { font-size: 0.85rem; }

.plan-btn {
  padding: 12px 18px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 1rem;
  cursor: pointer;
}

.game-progress { font-weight: 600; margin-bottom: 16px; }

.mode-panel { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.hint { color: #8a7f70; }

.text-input {
  width: 100%;
  padding: 12px;
  font-size: 1.2rem;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.mc-options { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.mc-option {
  padding: 14px;
  font-size: 1.05rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  text-align: left;
}

.tile-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 52px;
  width: 100%;
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 10px;
}
.tile {
  width: 42px;
  height: 42px;
  font-size: 1.2rem;
  font-weight: 700;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
}

.unscramble-controls { display: flex; gap: 10px; }

.feedback { font-weight: 700; min-height: 1.5em; }
.feedback:empty { visibility: hidden; }

.results-score { font-size: 1.4rem; font-weight: 700; }
.results-controls { display: flex; gap: 10px; margin-top: 16px; }

@media (min-width: 600px) {
  .mc-options { flex-direction: row; flex-wrap: wrap; }
  .mc-option { flex: 1 1 45%; }
}
```

- [ ] **Step 3: Write `script.js` (bootstrap + home screen + Hear-It-Type-It mode)**

```js
// script.js — the only file that touches the DOM.
(function () {
  'use strict';

  var state = {
    words: [],
    week: '',
    mode: null,
    order: [],
    index: 0,
    results: [],
    progress: null,
    unscrambleBuild: [],
    unscrambleBank: [],
  };

  var el = {};

  function cacheDom() {
    el.homeScreen = document.getElementById('home-screen');
    el.gameScreen = document.getElementById('game-screen');
    el.resultsScreen = document.getElementById('results-screen');
    el.weekLabel = document.getElementById('week-label');
    el.streakDisplay = document.getElementById('streak-display');
    el.loadError = document.getElementById('load-error');
    el.modeList = document.getElementById('mode-list');
    el.gameProgress = document.getElementById('game-progress');
    el.feedback = document.getElementById('feedback');

    el.hearTypePanel = document.getElementById('hear-type-panel');
    el.hearTypeInput = document.getElementById('hear-type-input');
    el.hearTypeSubmit = document.getElementById('hear-type-submit');
    el.hearTypeHint = document.getElementById('hear-type-hint');
    el.replayAudioBtn = document.getElementById('replay-audio-btn');

    el.mcPanel = document.getElementById('multiple-choice-panel');
    el.mcOptions = document.getElementById('mc-options');
    el.mcReplayBtn = document.getElementById('mc-replay-btn');

    el.unscramblePanel = document.getElementById('unscramble-panel');
    el.unscrambleBuild = document.getElementById('unscramble-build');
    el.unscrambleBank = document.getElementById('unscramble-bank');
    el.unscrambleReset = document.getElementById('unscramble-reset');
    el.unscrambleCheck = document.getElementById('unscramble-check');

    el.resultsScore = document.getElementById('results-score');
    el.resultsMissed = document.getElementById('results-missed');
    el.resultsReplayBtn = document.getElementById('results-replay-btn');
    el.resultsHomeBtn = document.getElementById('results-home-btn');
  }

  function init() {
    cacheDom();
    state.progress = Storage.loadProgress(window.localStorage);

    fetch('data/words.json')
      .then(function (res) {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.words) || data.words.length === 0) {
          throw new Error('empty word list');
        }
        state.words = data.words;
        state.week = data.week || '';
        renderHome();
      })
      .catch(function () {
        showLoadError();
      });

    el.modeList.addEventListener('click', onModeButtonClick);
    el.hearTypeSubmit.addEventListener('click', onHearTypeSubmit);
    el.hearTypeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') onHearTypeSubmit();
    });
    el.replayAudioBtn.addEventListener('click', function () {
      Speech.speak(state.order[state.index]);
    });
    el.resultsReplayBtn.addEventListener('click', function () { startRound(state.mode); });
    el.resultsHomeBtn.addEventListener('click', function () {
      el.resultsScreen.hidden = true;
      renderHome();
    });
  }

  function showLoadError() {
    el.loadError.hidden = false;
    el.loadError.textContent = 'No words loaded — check data/words.json';
    el.modeList.hidden = true;
  }

  function renderHome() {
    el.weekLabel.textContent = state.week ? 'Week of ' + state.week : '';
    renderStreak();
    renderStars();
    el.homeScreen.hidden = false;
  }

  function renderStreak() {
    var streak = state.progress.streak;
    el.streakDisplay.textContent = streak.count > 0
      ? '🔥 ' + streak.count + '-day streak'
      : 'Play today to start a streak!';
  }

  function renderStars() {
    ['hear-type', 'multiple-choice', 'unscramble'].forEach(function (mode) {
      var starEl = document.querySelector('[data-star-for="' + mode + '"]');
      var weekScores = state.progress.bestScores[state.week];
      var best = weekScores && weekScores[mode];
      starEl.hidden = best !== state.words.length;
    });
  }

  function onModeButtonClick(evt) {
    var btn = evt.target.closest('.mode-btn');
    if (!btn) return;
    startRound(btn.getAttribute('data-mode'));
  }

  function startRound(mode) {
    state.mode = mode;
    state.order = shuffleWords(state.words);
    state.index = 0;
    state.results = [];
    el.homeScreen.hidden = true;
    el.resultsScreen.hidden = true;
    el.gameScreen.hidden = false;
    el.hearTypePanel.hidden = mode !== 'hear-type';
    el.mcPanel.hidden = mode !== 'multiple-choice';
    el.unscramblePanel.hidden = mode !== 'unscramble';
    showCurrentWord();
  }

  function showCurrentWord() {
    el.feedback.textContent = '';
    el.gameProgress.textContent = 'Word ' + (state.index + 1) + ' of ' + state.order.length;
    var word = state.order[state.index];
    if (state.mode === 'hear-type') {
      setupHearType(word);
    }
    // multiple-choice and unscramble setup functions are added in Tasks 9-10.
  }

  function setupHearType(word) {
    el.hearTypeInput.value = '';
    el.hearTypeHint.hidden = true;
    if (Speech.isSupported()) {
      Speech.speak(word);
    } else {
      el.hearTypeHint.hidden = false;
      el.hearTypeHint.textContent =
        'Audio not supported on this browser — hint: ' + word.length + ' letters, starts with "' + word[0] + '"';
    }
    el.hearTypeInput.focus();
  }

  function onHearTypeSubmit() {
    var word = state.order[state.index];
    recordAnswer(checkAnswer(el.hearTypeInput.value, word));
  }

  function recordAnswer(correct) {
    state.results.push(correct);
    el.feedback.textContent = correct
      ? '✅ Correct!'
      : '❌ Not quite — it was "' + state.order[state.index] + '"';
    setTimeout(advance, 900);
  }

  function advance() {
    state.index++;
    if (state.index >= state.order.length) {
      finishRound();
    } else {
      showCurrentWord();
    }
  }

  function finishRound() {
    var score = tallyScore(state.results);
    var today = new Date().toISOString().slice(0, 10);
    state.progress = Storage.recordBestScore(state.progress, state.week, state.mode, score.correct);
    state.progress.streak = updateStreak(state.progress.streak, today);
    Storage.saveProgress(state.progress, window.localStorage);

    el.gameScreen.hidden = true;
    el.resultsScreen.hidden = false;
    el.resultsScore.textContent = score.correct + ' / ' + score.total;
    var missed = state.order.filter(function (w, i) { return !state.results[i]; });
    el.resultsMissed.textContent = missed.length ? 'Review: ' + missed.join(', ') : 'Perfect round! 🎉';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 4: Manually verify Hear-It-Type-It end-to-end**

Run: `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000/` in a browser (or on your phone via the machine's LAN IP).

Verify:
- Home screen shows the week label and "Play today to start a streak!"
- Clicking "🔊 Hear It, Type It" speaks the first word aloud and shows "Word 1 of 10"
- Typing the correct spelling and pressing Enter (or Check) shows "✅ Correct!" and advances
- Typing a wrong spelling shows "❌ Not quite — it was ..." with the correct word
- After the last word, the results screen shows a score like "8 / 10" and any missed words
- "Play Again" restarts the same mode; "Home" returns to the home screen with the streak now showing "🔥 1-day streak"
- Reloading the page preserves the streak (confirms localStorage persistence)

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css script.js
git commit -m "Add page shell, styling, and Hear-It-Type-It mode"
```

---

## Task 9: Multiple-choice mode wiring

**Files:**
- Modify: `script.js`

**Interfaces:**
- Consumes: `generateDistractors`, `shuffleWords` (Task 3, Task 2), `mc-options`/`mc-replay-btn` DOM elements (Task 8).
- Produces: `setupMultipleChoice(word)`, called from `showCurrentWord()`.

- [ ] **Step 1: Add the multiple-choice branch to `showCurrentWord()`**

```js
  function showCurrentWord() {
    el.feedback.textContent = '';
    el.gameProgress.textContent = 'Word ' + (state.index + 1) + ' of ' + state.order.length;
    var word = state.order[state.index];
    if (state.mode === 'hear-type') {
      setupHearType(word);
    } else if (state.mode === 'multiple-choice') {
      setupMultipleChoice(word);
    }
  }
```

- [ ] **Step 2: Add `setupMultipleChoice` and wire the replay button**

Add this function near `setupHearType`, and add the replay listener inside `init()` alongside the other listeners:

```js
  function setupMultipleChoice(word) {
    el.mcOptions.innerHTML = '';
    var distractors = generateDistractors(word, 3);
    var options = shuffleWords(distractors.concat([word]));
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mc-option';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        recordAnswer(opt === word);
      });
      el.mcOptions.appendChild(btn);
    });
    if (Speech.isSupported()) Speech.speak(word);
  }
```

In `init()`, add after the existing `el.replayAudioBtn` listener:

```js
    el.mcReplayBtn.addEventListener('click', function () {
      Speech.speak(state.order[state.index]);
    });
```

- [ ] **Step 3: Manually verify Multiple Choice end-to-end**

With the local server still running (`python3 -m http.server 8000`):

Verify:
- Clicking "🔤 Multiple Choice" speaks the word and shows 2-4 tappable options, one of which is the correct spelling
- Tapping the correct option shows "✅ Correct!"; tapping a wrong one shows "❌ Not quite..."
- "🔊 Replay" re-speaks the current word without advancing
- A full round completes and reaches the results screen correctly

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "Add Multiple Choice mode wiring"
```

---

## Task 10: Unscramble mode wiring

**Files:**
- Modify: `script.js`

**Interfaces:**
- Consumes: `scrambleLetters`, `checkAnswer` (Task 4, Task 2), `unscramble-build`/`unscramble-bank`/`unscramble-reset`/`unscramble-check` DOM elements (Task 8).
- Produces: `setupUnscramble(word)` and `renderUnscrambleTiles()`, called from `showCurrentWord()`.

- [ ] **Step 1: Add the unscramble branch to `showCurrentWord()`**

```js
    } else if (state.mode === 'multiple-choice') {
      setupMultipleChoice(word);
    } else if (state.mode === 'unscramble') {
      setupUnscramble(word);
    }
```

- [ ] **Step 2: Add `setupUnscramble`, `renderUnscrambleTiles`, and wire the reset/check buttons**

Add these functions near `setupMultipleChoice`:

```js
  function setupUnscramble(word) {
    state.unscrambleBuild = [];
    state.unscrambleBank = scrambleLetters(word);
    renderUnscrambleTiles();
  }

  function renderUnscrambleTiles() {
    el.unscrambleBuild.innerHTML = '';
    el.unscrambleBank.innerHTML = '';

    state.unscrambleBuild.forEach(function (letter, i) {
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile tile-build';
      tile.textContent = letter;
      tile.addEventListener('click', function () {
        state.unscrambleBank.push(state.unscrambleBuild.splice(i, 1)[0]);
        renderUnscrambleTiles();
      });
      el.unscrambleBuild.appendChild(tile);
    });

    state.unscrambleBank.forEach(function (letter, i) {
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile tile-bank';
      tile.textContent = letter;
      tile.addEventListener('click', function () {
        state.unscrambleBuild.push(state.unscrambleBank.splice(i, 1)[0]);
        renderUnscrambleTiles();
      });
      el.unscrambleBank.appendChild(tile);
    });
  }
```

In `init()`, add after the `el.mcReplayBtn` listener:

```js
    el.unscrambleReset.addEventListener('click', function () {
      state.unscrambleBank = state.unscrambleBank.concat(state.unscrambleBuild);
      state.unscrambleBuild = [];
      renderUnscrambleTiles();
    });
    el.unscrambleCheck.addEventListener('click', function () {
      var attempt = state.unscrambleBuild.join('');
      recordAnswer(checkAnswer(attempt, state.order[state.index]));
    });
```

- [ ] **Step 3: Manually verify Unscramble end-to-end**

Verify:
- Clicking "🧩 Unscramble" shows the word's letters as tiles in the bank row, in an order different from the correct spelling
- Tapping a bank tile moves it into the build row in order; tapping a build tile returns it to the bank
- "Reset" clears the build row back to the bank
- "Check" with the correct order shows "✅ Correct!"; with a wrong order shows "❌ Not quite..."
- A full round completes and reaches the results screen correctly

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "Add Unscramble mode wiring"
```

---

## Task 11: README and final QA pass

**Files:**
- Create: `README.md` (overwrite the placeholder)

**Interfaces:**
- Consumes: nothing (documentation only).

- [ ] **Step 1: Write `README.md`**

```markdown
# Spelling Practice

A phone-friendly spelling practice game for weekly word lists. Static
site — plain HTML/CSS/JS, no build tools, ready to publish as-is with
GitHub Pages.

## Structure

- `index.html` — the whole page: home screen, game screen, results screen
- `styles.css` — shared styling
- `script.js` — DOM rendering and event wiring for all three game modes
- `assets/logic.js` — pure game logic (shuffling, answer checking,
  multiple-choice distractor generation, letter scrambling, scoring,
  streak calculation), unit tested with Node's built-in test runner
- `assets/storage.js` — localStorage progress persistence, schema
  versioned, unit tested with an injected fake store
- `assets/speech.js` — Web Speech API wrapper (browser-only)
- `data/words.json` — the current week's word list

## Updating the weekly word list

Edit `data/words.json`:

```json
{
  "week": "2026-09-21",
  "words": ["example", "words", "here"]
}
```

`week` is a free-text label shown on the home screen and used as the
key for "best score" tracking, so a new week naturally starts fresh
best scores without losing history for prior weeks. Commit and push —
no other changes needed.

## Game modes

1. **Hear It, Type It** — the word is spoken aloud (Web Speech API);
   type the spelling. Falls back to a length/first-letter hint if
   speech isn't supported on the browser.
2. **Multiple Choice** — pick the correct spelling among a few
   algorithmically generated near-miss options.
3. **Unscramble** — tap scrambled letter tiles into the correct order.

Progress (best score per week/mode, and a daily play streak) is saved
in the browser's localStorage — private to that phone/browser, no
account needed.

## Running the tests

```bash
node --test tests/data.test.js
node --test tests/logic.test.js
node --test tests/storage.test.js
```

## Running locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Publishing

This site is designed to be served directly by GitHub Pages from the
repository root (no build step): Settings → Pages → deploy from the
`main` branch, root folder.
```

- [ ] **Step 2: Run the full test suite**

Run: `node --test tests/`
Expected: all tests across `data.test.js`, `logic.test.js`, and `storage.test.js` PASS.

- [ ] **Step 3: Full manual QA pass**

With `python3 -m http.server 8000` running, on a phone-width browser window (or an actual phone on the same network):

- Play a full round of each of the three modes back-to-back from a fresh `localStorage` (use a private/incognito window) and confirm all three complete and show correct results
- Confirm the streak increments once per day (can be checked by manually editing `localStorage.spelling-progress-v1`'s `lastPlayedDate` in devtools to yesterday's date and reloading, then playing a round)
- Confirm a star (⭐) appears on the home screen for a mode after a perfect round
- Confirm the empty-state message appears if `data/words.json` is temporarily renamed/removed (then restore it)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Add README with usage and publishing instructions"
```

---

## Task 12: Enable GitHub Pages

**Files:** none (repository settings only)

- [ ] **Step 1: Push the branch**

```bash
git push origin main
```

(Only after the user confirms they want to push — this is a shared/remote action.)

- [ ] **Step 2: Enable Pages**

In the GitHub repo's Settings → Pages, set Source to "Deploy from a branch," branch `main`, folder `/ (root)`, and save.

- [ ] **Step 3: Verify the published site**

Visit the URL GitHub Pages reports (typically `https://<username>.github.io/<repo>/`) on the phone and play through all three modes once more against the live deployment.
