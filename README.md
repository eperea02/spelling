# Spelling Practice

A phone-friendly spelling practice game for weekly word lists. Static
site — plain HTML/CSS/JS, no build tools, ready to publish as-is with
GitHub Pages.

## Structure

- `index.html` — the whole page: home screen, game screen, results screen
- `styles.css` — shared styling
- `script.js` — DOM rendering and event wiring for all five game modes
- `assets/logic.js` — pure game logic (shuffling, answer checking,
  multiple-choice distractor generation, letter scrambling, word search
  grid generation and selection matching, scoring, streak calculation),
  unit tested with Node's built-in test runner
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
4. **Word Search** — tap the first letter of a word, then its last
   letter, to find every word hidden in the grid (in any of 8
   directions, forwards or backwards).
5. **Flash Cards** — tap the card to hear the word and reveal its
   spelling, then self-grade with "I Knew It" / "Missed It".

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
