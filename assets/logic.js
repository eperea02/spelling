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

var WORD_SEARCH_DIRECTIONS = [
  { dr: 0, dc: 1 },   // right
  { dr: 0, dc: -1 },  // left
  { dr: 1, dc: 0 },   // down
  { dr: -1, dc: 0 },  // up
  { dr: 1, dc: 1 },   // down-right
  { dr: -1, dc: -1 }, // up-left
  { dr: 1, dc: -1 },  // down-left
  { dr: -1, dc: 1 },  // up-right
];

function computeWordSearchGridSize(words) {
  var longest = words.reduce(function (m, w) { return Math.max(m, w.length); }, 0);
  var totalLetters = words.reduce(function (sum, w) { return sum + w.length; }, 0);
  var bySpace = Math.ceil(Math.sqrt(totalLetters * 2.2));
  return Math.max(longest, bySpace, 8);
}

function canPlaceWordInGrid(grid, word, row, col, dr, dc) {
  var size = grid.length;
  for (var i = 0; i < word.length; i++) {
    var r = row + dr * i;
    var c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    var existing = grid[r][c];
    if (existing !== null && existing !== word[i]) return false;
  }
  return true;
}

function placeWordInGrid(grid, word, row, col, dr, dc) {
  var cells = [];
  for (var i = 0; i < word.length; i++) {
    var r = row + dr * i;
    var c = col + dc * i;
    grid[r][c] = word[i];
    cells.push([r, c]);
  }
  return cells;
}

// Places every word into a size×size grid (one of 8 directions each),
// then fills every remaining cell with a random letter. Word order is
// longest-first so the hardest-to-fit words get first pick of space.
function buildWordSearchGrid(words, size, randomFn) {
  randomFn = randomFn || Math.random;
  size = size || computeWordSearchGridSize(words);

  var upperWords = words.map(function (w) { return w.toUpperCase(); });
  var ordered = upperWords.slice().sort(function (a, b) { return b.length - a.length; });

  var grid = [];
  for (var r = 0; r < size; r++) {
    grid.push(new Array(size).fill(null));
  }

  var placements = [];

  ordered.forEach(function (word) {
    var placed = false;
    var maxAttempts = size * size * 8;
    for (var attempt = 0; attempt < maxAttempts && !placed; attempt++) {
      var dir = WORD_SEARCH_DIRECTIONS[Math.floor(randomFn() * WORD_SEARCH_DIRECTIONS.length)];
      var row = Math.floor(randomFn() * size);
      var col = Math.floor(randomFn() * size);
      if (canPlaceWordInGrid(grid, word, row, col, dir.dr, dir.dc)) {
        var cells = placeWordInGrid(grid, word, row, col, dir.dr, dir.dc);
        placements.push({ word: word, cells: cells });
        placed = true;
      }
    }
    if (!placed) {
      // Pathological word list (longer than the grid, or no space left) —
      // fall back to a straight row so the game never silently drops a
      // word instead of leaving it unfindable.
      var fallbackRow = placements.length % size;
      var fallbackCells = [];
      for (var i = 0; i < word.length && i < size; i++) {
        grid[fallbackRow][i] = word[i];
        fallbackCells.push([fallbackRow, i]);
      }
      placements.push({ word: word, cells: fallbackCells });
    }
  });

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var r2 = 0; r2 < size; r2++) {
    for (var c2 = 0; c2 < size; c2++) {
      if (grid[r2][c2] === null) {
        grid[r2][c2] = ALPHABET[Math.floor(randomFn() * ALPHABET.length)];
      }
    }
  }

  return { grid: grid, size: size, placements: placements };
}

// Returns the ordered list of [row, col] cells between two taps, or null
// if they don't form a straight horizontal/vertical/diagonal line.
function getWordSearchLineCells(startRow, startCol, endRow, endCol) {
  var dr = endRow - startRow;
  var dc = endCol - startCol;
  if (dr === 0 && dc === 0) return null;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;

  var steps = Math.max(Math.abs(dr), Math.abs(dc));
  var stepR = dr === 0 ? 0 : dr / Math.abs(dr);
  var stepC = dc === 0 ? 0 : dc / Math.abs(dc);
  var cells = [];
  for (var i = 0; i <= steps; i++) {
    cells.push([startRow + stepR * i, startCol + stepC * i]);
  }
  return cells;
}

function cellsToWordSearchString(grid, cells) {
  return cells.map(function (rc) { return grid[rc[0]][rc[1]]; }).join('');
}

// Returns the original (non-uppercased) word from `words` that the
// selected cells spell, forwards or backwards, or null if none match.
function matchWordSearchSelection(grid, cells, words) {
  if (!cells || cells.length < 2) return null;
  var forward = cellsToWordSearchString(grid, cells);
  var backward = forward.split('').reverse().join('');
  for (var i = 0; i < words.length; i++) {
    var upper = words[i].toUpperCase();
    if (upper === forward || upper === backward) return words[i];
  }
  return null;
}

// Finds a row/col/direction where `word` can be placed intersecting one
// letter of an already-placed slot, by scanning existing slots in placement
// order and trying each shared-letter pair in index order. Returns the
// first valid placement found, or null if the word shares no usable letter
// with anything placed so far.
function findCrosswordIntersection(grid, word, placedSlots) {
  for (var s = 0; s < placedSlots.length; s++) {
    var slot = placedSlots[s];
    for (var i = 0; i < slot.word.length; i++) {
      for (var j = 0; j < word.length; j++) {
        if (slot.word[i] !== word[j]) continue;
        var dir = slot.dir === 'across'
          ? { dr: 1, dc: 0, row: slot.row - j, col: slot.col + i }
          : { dr: 0, dc: 1, row: slot.row + i, col: slot.col - j };
        if (canPlaceWordInGrid(grid, word, dir.row, dir.col, dir.dr, dir.dc)) {
          return { row: dir.row, col: dir.col, dr: dir.dr, dc: dir.dc };
        }
      }
    }
  }
  return null;
}

// Assigns the same ascending clue number to every slot starting at a given
// cell, in row-major order of starting cell — standard crossword numbering.
function numberCrosswordSlots(slots) {
  var numberByKey = {};
  var starts = [];
  slots.forEach(function (slot) {
    var key = slot.row + ',' + slot.col;
    if (numberByKey[key] === undefined) {
      numberByKey[key] = null;
      starts.push({ row: slot.row, col: slot.col, key: key });
    }
  });
  starts.sort(function (a, b) { return a.row - b.row || a.col - b.col; });
  starts.forEach(function (s, i) { numberByKey[s.key] = i + 1; });
  slots.forEach(function (slot) { slot.number = numberByKey[slot.row + ',' + slot.col]; });
}

// Builds a crossword layout for an arbitrary word list: places each word
// (longest first) intersecting an already-placed word's shared letter where
// possible, falling back to its own disconnected row when no intersection
// is found, so every word always ends up placed. Deterministic — no
// randomness is needed since placement is driven by letter matching, not
// chance.
function buildCrosswordLayout(words) {
  var upperWords = words.map(function (w) { return w.toUpperCase(); });
  var totalLength = upperWords.reduce(function (sum, w) { return sum + w.length; }, 0);
  var longest = upperWords.reduce(function (m, w) { return Math.max(m, w.length); }, 0);
  var workingSize = totalLength + longest + 20;
  var origin = Math.floor(workingSize / 2);

  var grid = [];
  for (var r = 0; r < workingSize; r++) grid.push(new Array(workingSize).fill(null));

  var ordered = upperWords
    .map(function (w, i) { return { word: w, originalIndex: i }; })
    .sort(function (a, b) { return b.word.length - a.word.length || a.originalIndex - b.originalIndex; });

  var slots = [];
  var nextFallbackRow = origin;

  ordered.forEach(function (entry) {
    var word = entry.word;
    var placement = slots.length === 0 ? null : findCrosswordIntersection(grid, word, slots);

    if (!placement) {
      // No shared letter with anything placed yet — start it on its own
      // fresh row. Keep trying further rows if an earlier word's vertical
      // slot happens to cross this row, so it's never dropped or corrupted.
      var row = slots.length === 0 ? origin : nextFallbackRow;
      while (!canPlaceWordInGrid(grid, word, row, origin, 0, 1)) row += 1;
      placement = { row: row, col: origin, dr: 0, dc: 1 };
      nextFallbackRow = row + 2;
    }

    var cells = placeWordInGrid(grid, word, placement.row, placement.col, placement.dr, placement.dc);
    slots.push({
      word: word,
      row: placement.row,
      col: placement.col,
      dir: placement.dr === 0 ? 'across' : 'down',
      cells: cells,
    });
  });

  var minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  slots.forEach(function (slot) {
    slot.cells.forEach(function (rc) {
      minRow = Math.min(minRow, rc[0]);
      maxRow = Math.max(maxRow, rc[0]);
      minCol = Math.min(minCol, rc[1]);
      maxCol = Math.max(maxCol, rc[1]);
    });
  });

  var rows = maxRow - minRow + 1;
  var cols = maxCol - minCol + 1;
  var trimmedGrid = [];
  for (var tr = 0; tr < rows; tr++) trimmedGrid.push(new Array(cols).fill(null));

  slots.forEach(function (slot) {
    slot.row -= minRow;
    slot.col -= minCol;
    slot.cells = slot.cells.map(function (rc) { return [rc[0] - minRow, rc[1] - minCol]; });
    slot.cells.forEach(function (rc, i) { trimmedGrid[rc[0]][rc[1]] = slot.word[i]; });
  });

  numberCrosswordSlots(slots);

  return { rows: rows, cols: cols, grid: trimmedGrid, slots: slots };
}

// Returns the indexes into layout.slots of every slot that includes the
// given cell (0 for a blocked/unused cell, 1 for a normal cell, 2 at an
// intersection of an across and a down word).
function crosswordSlotsAtCell(layout, row, col) {
  var result = [];
  layout.slots.forEach(function (slot, idx) {
    var found = slot.cells.some(function (rc) { return rc[0] === row && rc[1] === col; });
    if (found) result.push(idx);
  });
  return result;
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
    computeWordSearchGridSize: computeWordSearchGridSize,
    canPlaceWordInGrid: canPlaceWordInGrid,
    placeWordInGrid: placeWordInGrid,
    buildWordSearchGrid: buildWordSearchGrid,
    getWordSearchLineCells: getWordSearchLineCells,
    matchWordSearchSelection: matchWordSearchSelection,
    buildCrosswordLayout: buildCrosswordLayout,
    crosswordSlotsAtCell: crosswordSlotsAtCell,
  };
}
