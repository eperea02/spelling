// tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  shuffleWords, checkAnswer, generateDistractors, scrambleLetters,
  tallyScore, updateStreak, toLocalDateString,
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
