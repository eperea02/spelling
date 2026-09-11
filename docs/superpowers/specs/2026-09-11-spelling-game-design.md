# Spelling Practice Game — Design

Date: 2026-09-11

## Purpose

A static web app so the user's son can practice his weekly spelling
words on a phone, similar in spirit to Claude-artifact spelling games
already tried. Hosted on GitHub Pages, updated by hand-editing a word
list each week (same workflow as the existing `workouts` repo).

## Non-goals

- No accounts, no server, no backend of any kind.
- No cross-device sync of progress (localStorage only, per browser).
- No external dictionary/spellcheck API — everything (including wrong
  multiple-choice options) is generated from the week's own word list.
- No audio files — speech uses the browser's built-in Web Speech API
  (`SpeechSynthesis`). If unavailable, the game degrades gracefully
  (word not spoken, but still playable by reading the on-screen prompt
  where the mode shows text, or a visible note that audio isn't
  supported in "hear it, type it").

## Architecture

Static site, plain HTML/CSS/JS, no build step, deployed straight from
the repository root via GitHub Pages — mirrors the `workouts` repo's
approach.

```
/
├── index.html          — mode-select screen + game screen (single page, dynamic sections)
├── styles.css          — mobile-first styling (phone is the primary device)
├── script.js           — UI orchestration: renders screens, wires buttons/taps, calls into logic/speech/storage
├── assets/
│   ├── logic.js         — pure functions, no DOM, unit tested
│   ├── speech.js         — thin wrapper around Web Speech API
│   └── storage.js         — thin wrapper around localStorage
├── data/
│   └── words.json         — current week's word list
├── tests/
│   └── logic.test.js       — node --test for assets/logic.js
└── README.md
```

Each unit's responsibility:

- **logic.js** — round setup (shuffle word order), multiple-choice
  distractor generation, letter-scramble generation, answer checking,
  score tallying, streak-date calculation. Pure input→output functions
  only; independently testable without a browser.
- **speech.js** — `isSupported()`, `speak(word)`, `cancel()`. Isolates
  all `window.speechSynthesis` usage so the rest of the app never
  touches the Web Speech API directly.
- **storage.js** — `loadProgress()`, `saveProgress(progress)` with a
  versioned schema (see below) and safe defaults if localStorage is
  empty, disabled, or holds data from an older schema version.
- **script.js** — the only module that touches the DOM. Reads
  `data/words.json`, drives the three game modes by calling into
  `logic.js`/`speech.js`/`storage.js`, and renders screens.

## Data model

`data/words.json`:

```json
{
  "week": "2026-09-14",
  "words": ["because", "friend", "believe", "although", "separate"]
}
```

- `week` is a free-text label shown in the UI (e.g. "Week of Sep 14")
  and also used as the key for progress tracking, so switching to a
  new week's list resets the "best score" stat but not the day streak.
- `words` is a flat array of lowercase strings. No sentences, no
  definitions, no per-word metadata — kept minimal per requirements.
- To update for a new week: edit this file, commit, push. No in-app
  data entry.

## Game modes

All three modes pull from the same shuffled word order for a round
and share the same results screen. A home screen lets the player pick
a mode; word order is reshuffled (via `logic.js`) each time a round
starts.

### 1. Hear it, type it

- `speech.speak(word)` reads the word aloud (fires automatically per
  word, plus a "🔊 replay" button).
- A text input captures the typed answer; submitting (Enter or a
  Check button) compares case-insensitively via `logic.checkAnswer`.
- Immediate right/wrong feedback, then advance to the next word.
- If `speech.isSupported()` is false, show the word's first letter and
  length as a hint (e.g. "b _ _ _ _ _ _" for "because") instead of
  silently failing, plus a small note that audio isn't available on
  this browser.

### 2. Multiple choice

- `speech.speak(word)` reads the word aloud; the word itself is never
  shown before answering.
- `logic.generateDistractors(word, count=3)` builds wrong options by
  applying simple mutations to the real word:
  - swap two adjacent letters
  - drop one letter
  - duplicate one letter
  - replace one vowel with a different vowel
- Distractors are deduplicated against each other and against the
  real word; if mutation collisions leave fewer than `count` unique
  distractors (short words), fall back to additional mutation passes
  before giving up and showing fewer options (minimum 2 total
  choices).
- Options (real word + distractors) are shuffled into a button grid;
  tapping one gives immediate feedback and advances.

### 3. Unscramble

- `logic.scrambleLetters(word)` returns a shuffled letter order that
  is guaranteed different from the original (re-shuffles on a
  collision; for words of 1 letter, or fewer than 2 unique orderings
  possible, it's returned as-is since no valid scramble exists).
- Letters render as tappable tiles in a "build" row plus a "bank" row;
  tapping a bank tile moves it to the next build slot, tapping a build
  tile returns it to the bank. A "check" button compares the built
  order to the answer; "reset" clears the build row back to the bank.

### Shared round flow

- Round = all words in the current list, in shuffled order.
- Header shows "Word 3 of 8" and the current mode.
- End-of-round results screen: score (e.g. "6/8"), list of missed
  words, buttons to replay the same mode or return to the home screen.

## Progress tracking

Stored in `localStorage` under one key, JSON-encoded, schema-versioned
so future changes can migrate or reset safely:

```json
{
  "schemaVersion": 1,
  "bestScores": {
    "2026-09-14": { "hear-type": 6, "multiple-choice": 8, "unscramble": 7 }
  },
  "streak": { "count": 4, "lastPlayedDate": "2026-09-11" }
}
```

- `bestScores` is keyed by the word list's `week` label, then by mode;
  storing the best (words correct) achieved for that list+mode. A new
  `week` value in `words.json` naturally starts fresh best scores for
  that week without deleting history for prior weeks.
- `streak.count` increments once per calendar day the first time any
  round is completed that day (comparing `lastPlayedDate` to today's
  local date); it resets to 1 if a day was skipped, and is untouched
  by multiple rounds played the same day.
- The home screen shows current streak and, per mode, a star if
  `bestScores[currentWeek][mode] === words.length` (a perfect round).
- If localStorage is unavailable (disabled/private mode) or the stored
  JSON fails to parse/doesn't match the expected shape,
  `storage.loadProgress()` returns fresh defaults and the game plays
  on without persistence rather than erroring.

## Error handling

- Missing/unreachable `data/words.json`, or a list with zero words:
  home screen shows a friendly message ("No words loaded — check
  `data/words.json`") instead of letting the player enter a broken
  round.
- Unsupported Web Speech API: handled per-mode as described above,
  never a hard failure.
- Corrupt/unexpected localStorage contents: treated as empty progress
  (see above).

## Testing

- `node --test tests/logic.test.js` covers: distractor generation
  (never includes the real word, never has duplicates, respects the
  minimum-2-choices fallback for short words), letter scrambling
  (never equals original order except when mathematically
  unavoidable), answer checking (case-insensitivity, whitespace
  trimming), score tallying, and streak-date transitions (same day,
  next day, skipped day).
- UI/game-flow correctness (all three modes playable end-to-end,
  audio, localStorage persistence across reloads) is verified manually
  in a browser against a local server before calling the work done —
  no browser-automation test harness is being introduced for this.

## Publishing

Served directly from the repository root via GitHub Pages (Settings →
Pages → deploy from `main` branch, root), no build step — same as the
`workouts` repo.
