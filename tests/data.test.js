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

test('words.json sentences (if present) only key off real words', () => {
  const data = JSON.parse(raw);
  if (!data.sentences) return;
  Object.keys(data.sentences).forEach((word) => {
    assert.ok(data.words.includes(word), `"${word}" in sentences is not in words`);
  });
});

test('words.json sentences (if present) each contain their word as a whole word', () => {
  const data = JSON.parse(raw);
  if (!data.sentences) return;
  Object.entries(data.sentences).forEach(([word, sentence]) => {
    assert.strictEqual(typeof sentence, 'string');
    const re = new RegExp('\\b' + word + '\\b', 'i');
    assert.ok(re.test(sentence), `sentence for "${word}" does not contain the word: "${sentence}"`);
  });
});
