// tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  shuffleWords, checkAnswer, generateDistractors, scrambleLetters,
  tallyScore, updateStreak, toLocalDateString,
  computeWordSearchGridSize, canPlaceWordInGrid, placeWordInGrid,
  buildWordSearchGrid, getWordSearchLineCells, matchWordSearchSelection,
  spellOutWord, maskWord, buildMemoryDeck, buildSentencePrompt, maskSentence,
} = require('../assets/logic.js');

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
  // Fisher-Yates with randomFn always 0 produces this deterministic permutation
  assert.deepStrictEqual(result, ['b', 'c', 'd', 'a']);
});

test('checkAnswer matches case-insensitively', () => {
  assert.strictEqual(checkAnswer('Because', 'because'), true);
  assert.strictEqual(checkAnswer('BECAUSE', 'because'), true);
});

test('checkAnswer trims surrounding whitespace', () => {
  assert.strictEqual(checkAnswer('  because  ', 'because'), true);
});

test('spellOutWord joins uppercased letters with periods', () => {
  assert.strictEqual(spellOutWord('crash'), 'C. R. A. S. H.');
});

test('spellOutWord uppercases an already-mixed-case word', () => {
  assert.strictEqual(spellOutWord('Crash'), 'C. R. A. S. H.');
});

test('spellOutWord handles a single letter', () => {
  assert.strictEqual(spellOutWord('a'), 'A.');
});

test('checkAnswer rejects wrong spelling', () => {
  assert.strictEqual(checkAnswer('becuase', 'because'), false);
});

test('checkAnswer rejects non-string input safely', () => {
  assert.strictEqual(checkAnswer(undefined, 'because'), false);
  assert.strictEqual(checkAnswer(null, 'because'), false);
});

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

test('scrambleLetters returns the same letters as the original word', () => {
  const result = scrambleLetters('friend', Math.random);
  assert.deepStrictEqual(result.slice().sort(), 'friend'.split('').sort());
});

test('scrambleLetters returns a different order than the original for a typical word', () => {
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

test('toLocalDateString formats a local date without UTC conversion', () => {
  const d = new Date(2026, 8, 11); // month is 0-indexed: September 11, 2026
  assert.strictEqual(toLocalDateString(d), '2026-09-11');
});

test('toLocalDateString zero-pads single-digit month and day', () => {
  const d = new Date(2026, 0, 5); // January 5, 2026
  assert.strictEqual(toLocalDateString(d), '2026-01-05');
});

test('computeWordSearchGridSize is at least as large as the longest word', () => {
  const size = computeWordSearchGridSize(['a', 'crash', 'be']);
  assert.ok(size >= 5);
});

test('computeWordSearchGridSize has a floor of 8 for short word lists', () => {
  const size = computeWordSearchGridSize(['a', 'be']);
  assert.strictEqual(size, 8);
});

test('computeWordSearchGridSize grows with total letter count', () => {
  const small = computeWordSearchGridSize(['cat', 'dog']);
  const large = computeWordSearchGridSize(['important', 'beautiful', 'friend', 'because', 'people', 'through']);
  assert.ok(large > small);
});

test('canPlaceWordInGrid rejects placement that runs off the grid', () => {
  const grid = [[null, null], [null, null]];
  assert.strictEqual(canPlaceWordInGrid(grid, 'CAT', 0, 0, 0, 1), false);
});

test('canPlaceWordInGrid allows placement on an empty grid that fits', () => {
  const grid = [[null, null, null], [null, null, null], [null, null, null]];
  assert.strictEqual(canPlaceWordInGrid(grid, 'CAT', 0, 0, 0, 1), true);
});

test('canPlaceWordInGrid allows crossing an existing matching letter', () => {
  const grid = [[null, null, null], [null, null, null], [null, null, null]];
  placeWordInGrid(grid, 'CAT', 0, 0, 1, 0); // vertical C-A-T down column 0
  assert.strictEqual(canPlaceWordInGrid(grid, 'CAB', 0, 0, 0, 1), true); // shares the 'C'
});

test('canPlaceWordInGrid rejects a conflicting letter', () => {
  const grid = [[null, null, null], [null, null, null], [null, null, null]];
  placeWordInGrid(grid, 'CAT', 0, 0, 1, 0); // vertical C-A-T down column 0
  assert.strictEqual(canPlaceWordInGrid(grid, 'DOG', 0, 0, 0, 1), false); // 'D' vs existing 'C'
});

test('placeWordInGrid writes each letter and returns the cells used', () => {
  const grid = [[null, null, null], [null, null, null], [null, null, null]];
  const cells = placeWordInGrid(grid, 'CAT', 0, 0, 0, 1);
  assert.deepStrictEqual(grid[0], ['C', 'A', 'T']);
  assert.deepStrictEqual(cells, [[0, 0], [0, 1], [0, 2]]);
});

test('buildWordSearchGrid places every word findable in the grid at its recorded cells', () => {
  const words = ['cash', 'dash', 'crash', 'trash', 'what', 'why'];
  const { grid, placements } = buildWordSearchGrid(words, 12, Math.random);
  assert.strictEqual(placements.length, words.length);
  placements.forEach((p) => {
    const spelled = p.cells.map(([r, c]) => grid[r][c]).join('');
    assert.strictEqual(spelled, p.word.toUpperCase());
  });
});

test('buildWordSearchGrid fills every cell, leaving no gaps', () => {
  const { grid, size } = buildWordSearchGrid(['cat', 'dog'], 8, Math.random);
  assert.strictEqual(grid.length, size);
  grid.forEach((row) => {
    assert.strictEqual(row.length, size);
    row.forEach((cell) => assert.ok(/^[A-Z]$/.test(cell)));
  });
});

test('buildWordSearchGrid is deterministic given a fixed randomFn', () => {
  const words = ['cat', 'dog', 'bird'];
  const a = buildWordSearchGrid(words, 8, () => 0.42);
  const b = buildWordSearchGrid(words, 8, () => 0.42);
  assert.deepStrictEqual(a.grid, b.grid);
  assert.deepStrictEqual(a.placements, b.placements);
});

test('buildWordSearchGrid defaults to a computed size when none is given', () => {
  const { size } = buildWordSearchGrid(['cat', 'dog'], undefined, Math.random);
  assert.strictEqual(size, computeWordSearchGridSize(['cat', 'dog']));
});

test('getWordSearchLineCells returns cells for a horizontal line', () => {
  assert.deepStrictEqual(getWordSearchLineCells(2, 1, 2, 4), [[2, 1], [2, 2], [2, 3], [2, 4]]);
});

test('getWordSearchLineCells returns cells for a vertical line', () => {
  assert.deepStrictEqual(getWordSearchLineCells(0, 3, 3, 3), [[0, 3], [1, 3], [2, 3], [3, 3]]);
});

test('getWordSearchLineCells returns cells for a diagonal line', () => {
  assert.deepStrictEqual(getWordSearchLineCells(0, 0, 3, 3), [[0, 0], [1, 1], [2, 2], [3, 3]]);
});

test('getWordSearchLineCells returns cells for a reverse-direction line', () => {
  assert.deepStrictEqual(getWordSearchLineCells(3, 3, 0, 0), [[3, 3], [2, 2], [1, 1], [0, 0]]);
});

test('getWordSearchLineCells rejects a non-straight, non-diagonal selection', () => {
  assert.strictEqual(getWordSearchLineCells(0, 0, 2, 3), null);
});

test('getWordSearchLineCells rejects selecting the same cell twice', () => {
  assert.strictEqual(getWordSearchLineCells(1, 1, 1, 1), null);
});

test('matchWordSearchSelection matches a forward selection', () => {
  const grid = [['C', 'A', 'T']];
  const cells = [[0, 0], [0, 1], [0, 2]];
  assert.strictEqual(matchWordSearchSelection(grid, cells, ['cat', 'dog']), 'cat');
});

test('matchWordSearchSelection matches a backward selection', () => {
  const grid = [['T', 'A', 'C']];
  const cells = [[0, 0], [0, 1], [0, 2]];
  assert.strictEqual(matchWordSearchSelection(grid, cells, ['cat', 'dog']), 'cat');
});

test('matchWordSearchSelection returns null for a non-matching selection', () => {
  const grid = [['X', 'Y', 'Z']];
  const cells = [[0, 0], [0, 1], [0, 2]];
  assert.strictEqual(matchWordSearchSelection(grid, cells, ['cat', 'dog']), null);
});

test('matchWordSearchSelection returns null for fewer than 2 cells', () => {
  const grid = [['C']];
  assert.strictEqual(matchWordSearchSelection(grid, [[0, 0]], ['cat']), null);
  assert.strictEqual(matchWordSearchSelection(grid, null, ['cat']), null);
});

test('maskWord returns the same length, uppercased, with only letters or underscores', () => {
  const result = maskWord('crash', () => 0.3);
  assert.strictEqual(result.length, 5);
  assert.match(result, /^[A-Z_]+$/);
});

test('maskWord blanks about 40% of letters, rounded', () => {
  const result = maskWord('crash', () => 0.3);
  const blanks = result.split('').filter((ch) => ch === '_').length;
  assert.strictEqual(blanks, 2); // round(5 * 0.4) = 2
});

test('maskWord always blanks at least one letter, even for very short words', () => {
  const result = maskWord('at', () => 0.9);
  const blanks = result.split('').filter((ch) => ch === '_').length;
  assert.ok(blanks >= 1);
});

test('maskWord keeps revealed letters matching the uppercased original word', () => {
  const word = 'crash';
  const upper = word.toUpperCase();
  const result = maskWord(word, () => 0.3);
  for (let i = 0; i < upper.length; i++) {
    if (result[i] !== '_') assert.strictEqual(result[i], upper[i]);
  }
});

test('maskWord is deterministic given the same randomFn', () => {
  assert.strictEqual(maskWord('crash', () => 0.3), maskWord('crash', () => 0.3));
});

test('buildMemoryDeck creates one sound card and one text card per word', () => {
  const deck = buildMemoryDeck(['cat', 'dog'], () => 0);
  assert.strictEqual(deck.length, 4);
  const catCards = deck.filter((c) => c.word === 'cat');
  assert.strictEqual(catCards.length, 2);
  assert.deepStrictEqual(catCards.map((c) => c.type).sort(), ['sound', 'text']);
});

test('buildMemoryDeck does not mutate the input words array', () => {
  const words = ['cat', 'dog'];
  const copy = [...words];
  buildMemoryDeck(words, () => 0.5);
  assert.deepStrictEqual(words, copy);
});

test('buildMemoryDeck shuffles the cards rather than leaving them grouped by word', () => {
  const words = ['cat', 'dog', 'bird'];
  const deck = buildMemoryDeck(words, () => 0);
  const sequentialOrder = [];
  words.forEach((w) => { sequentialOrder.push(w + ':sound'); sequentialOrder.push(w + ':text'); });
  const actualOrder = deck.map((c) => c.word + ':' + c.type);
  assert.notDeepStrictEqual(actualOrder, sequentialOrder);
});

test('buildSentencePrompt says the word, then the sentence, then the word again', () => {
  assert.strictEqual(
    buildSentencePrompt('crash', 'The car had a crash.'),
    'crash. The car had a crash. crash.'
  );
});

test('buildSentencePrompt repeats the word when no sentence is available', () => {
  assert.strictEqual(buildSentencePrompt('crash', undefined), 'crash. crash.');
  assert.strictEqual(buildSentencePrompt('crash', ''), 'crash. crash.');
});

test('maskSentence blanks the word out with underscores matching its length', () => {
  assert.strictEqual(maskSentence('The car had a crash.', 'crash'), 'The car had a _____.');
});

test('maskSentence matches the word case-insensitively', () => {
  assert.strictEqual(maskSentence('This is fun.', 'this'), '____ is fun.');
});

test('maskSentence leaves the sentence unchanged if the word is not found in it', () => {
  assert.strictEqual(maskSentence('Hello there.', 'crash'), 'Hello there.');
});
