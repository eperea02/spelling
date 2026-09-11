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
