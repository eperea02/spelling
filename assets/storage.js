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
