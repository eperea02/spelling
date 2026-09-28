# Spelling Practice

A phone-friendly spelling practice game for weekly word lists. Static
site — plain HTML/CSS/JS, no build tools, ready to publish as-is with
GitHub Pages.

## Structure

- `index.html` — the whole page: home screen, game screen, results screen
- `styles.css` — shared styling
- `script.js` — DOM rendering and event wiring for all eight game modes
- `assets/logic.js` — pure game logic (shuffling, answer checking,
  multiple-choice distractor generation, letter scrambling, word search
  grid generation and selection matching, word masking, memory-match deck
  building, sentence-prompt building, scoring, streak calculation),
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
  "words": ["example", "words", "here"],
  "sentences": {
    "example": "This is an example sentence."
  }
}
```

`week` is a free-text label shown on the home screen and used as the
key for "best score" tracking, so a new week naturally starts fresh
best scores without losing history for prior weeks.

`sentences` is optional and only used by the **Spell It in a Sentence**
mode: a map from word to one example sentence that contains that word
(any case). Words without a sentence still work in every mode —
Spell It in a Sentence just falls back to repeating the word instead
of using it in context. Commit and push — no other changes needed.

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
6. **Missing Letter** — the word appears with about 40% of its letters
   blanked out; type the full word.
7. **Spell It in a Sentence** — spelling-bee style: the word is spoken,
   used in a sentence, then spoken again (with the sentence also shown
   on screen, word blanked out); type the word.
8. **Memory Match** — flip two cards at a time to pair each word's
   spoken-word card with its written-spelling card.

Every typing/speaking mode alternates on each replay between saying it
plainly (the whole word, or the full sentence prompt in Spell It in a
Sentence) and a letter-by-letter spell-out ("C. R. A. S. H."),
resetting back to the plain version whenever a new word comes up.
Memory Match always says the plain word on each card flip, since
recognizing the word by ear is the point of that mode.

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
