// tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const { shuffleWords, checkAnswer, generateDistractors } = require('../assets/logic.js');

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
