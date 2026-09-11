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

test('loadProgress returns defaults when bestScores is null', () => {
  var store = fakeStore({});
  store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, bestScores: null, streak: { count: 2, lastPlayedDate: '2026-09-10' } }));
  assert.deepStrictEqual(loadProgress(store), defaultProgress());
});

test('loadProgress returns defaults when bestScores is an array', () => {
  var store = fakeStore({});
  store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, bestScores: [], streak: { count: 2, lastPlayedDate: '2026-09-10' } }));
  assert.deepStrictEqual(loadProgress(store), defaultProgress());
});

test('loadProgress returns defaults when streak.lastPlayedDate is not a string or null', () => {
  var store = fakeStore({});
  store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, bestScores: {}, streak: { count: 2, lastPlayedDate: 12345 } }));
  assert.deepStrictEqual(loadProgress(store), defaultProgress());
});

test('recordBestScore does not mutate the input progress object', () => {
  var progress = defaultProgress();
  recordBestScore(progress, '2026-09-14', 'hear-type', 6);
  assert.deepStrictEqual(progress.bestScores, {});
});
