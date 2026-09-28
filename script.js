// script.js — the only file that touches the DOM.
(function () {
  'use strict';

  var state = {
    words: [],
    week: '',
    mode: null,
    order: [],
    index: 0,
    results: [],
    progress: null,
    unscrambleBuild: [],
    unscrambleBank: [],
    awaitingAdvance: false,
    advanceTimer: null,
    wsGrid: null,
    wsCellEls: null,
    wsFirstCell: null,
    wsFound: {},
    wsFlashTimer: null,
    flashCardFlipped: false,
    speakCount: 0,
    sentences: {},
    memoryCards: [],
    memoryFirstIndex: null,
    memoryMatchedCount: 0,
    memoryBusy: false,
    memoryFlashTimer: null,
  };

  var el = {};

  function cacheDom() {
    el.homeScreen = document.getElementById('home-screen');
    el.gameScreen = document.getElementById('game-screen');
    el.resultsScreen = document.getElementById('results-screen');
    el.weekLabel = document.getElementById('week-label');
    el.streakDisplay = document.getElementById('streak-display');
    el.loadError = document.getElementById('load-error');
    el.modeList = document.getElementById('mode-list');
    el.gameProgress = document.getElementById('game-progress');
    el.gameHomeBtn = document.getElementById('game-home-btn');
    el.feedback = document.getElementById('feedback');

    el.hearTypePanel = document.getElementById('hear-type-panel');
    el.hearTypeInput = document.getElementById('hear-type-input');
    el.hearTypeSubmit = document.getElementById('hear-type-submit');
    el.hearTypeHint = document.getElementById('hear-type-hint');
    el.sentenceContext = document.getElementById('sentence-context');
    el.replayAudioBtn = document.getElementById('replay-audio-btn');

    el.mcPanel = document.getElementById('multiple-choice-panel');
    el.mcOptions = document.getElementById('mc-options');
    el.mcReplayBtn = document.getElementById('mc-replay-btn');

    el.unscramblePanel = document.getElementById('unscramble-panel');
    el.unscrambleReplayBtn = document.getElementById('unscramble-replay-btn');
    el.unscrambleBuild = document.getElementById('unscramble-build');
    el.unscrambleBank = document.getElementById('unscramble-bank');
    el.unscrambleReset = document.getElementById('unscramble-reset');
    el.unscrambleCheck = document.getElementById('unscramble-check');

    el.wsPanel = document.getElementById('word-search-panel');
    el.wsGrid = document.getElementById('ws-grid');
    el.wsWordList = document.getElementById('ws-word-list');

    el.flashCardPanel = document.getElementById('flash-card-panel');
    el.flashCard = document.getElementById('flash-card');
    el.flashCardFront = document.getElementById('flash-card-front');
    el.flashCardBack = document.getElementById('flash-card-back');
    el.flashCardGrade = document.getElementById('flash-card-grade');
    el.flashCardKnewIt = document.getElementById('flash-card-knew-it');
    el.flashCardMissed = document.getElementById('flash-card-missed');

    el.missingLetterPanel = document.getElementById('missing-letter-panel');
    el.missingLetterWord = document.getElementById('missing-letter-word');
    el.missingLetterInput = document.getElementById('missing-letter-input');
    el.missingLetterSubmit = document.getElementById('missing-letter-submit');
    el.missingLetterReplayBtn = document.getElementById('missing-letter-replay-btn');

    el.memoryMatchPanel = document.getElementById('memory-match-panel');
    el.memoryGrid = document.getElementById('memory-grid');

    el.resultsScore = document.getElementById('results-score');
    el.resultsMissed = document.getElementById('results-missed');
    el.resultsReplayBtn = document.getElementById('results-replay-btn');
    el.resultsHomeBtn = document.getElementById('results-home-btn');
  }

  function init() {
    cacheDom();
    state.progress = ProgressStore.loadProgress(window.localStorage);

    fetch('data/words.json')
      .then(function (res) {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.words) || data.words.length === 0) {
          throw new Error('empty word list');
        }
        state.words = data.words;
        state.week = data.week || '';
        state.sentences = data.sentences || {};
        renderHome();
      })
      .catch(function () {
        showLoadError();
      });

    el.modeList.addEventListener('click', onModeButtonClick);
    el.hearTypeSubmit.addEventListener('click', onHearTypeSubmit);
    el.hearTypeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') onHearTypeSubmit();
    });
    el.replayAudioBtn.addEventListener('click', speakCurrentWord);
    el.mcReplayBtn.addEventListener('click', speakCurrentWord);
    el.unscrambleReplayBtn.addEventListener('click', speakCurrentWord);
    el.unscrambleReset.addEventListener('click', function () {
      state.unscrambleBank = state.unscrambleBank.concat(state.unscrambleBuild);
      state.unscrambleBuild = [];
      renderUnscrambleTiles();
    });
    el.unscrambleCheck.addEventListener('click', function () {
      if (state.awaitingAdvance) return;
      var attempt = state.unscrambleBuild.join('');
      recordAnswer(checkAnswer(attempt, state.order[state.index]));
    });
    el.flashCard.addEventListener('click', onFlashCardTap);
    el.flashCardKnewIt.addEventListener('click', function () {
      if (state.awaitingAdvance) return;
      recordAnswer(true);
    });
    el.flashCardMissed.addEventListener('click', function () {
      if (state.awaitingAdvance) return;
      recordAnswer(false);
    });
    el.missingLetterSubmit.addEventListener('click', onMissingLetterSubmit);
    el.missingLetterInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') onMissingLetterSubmit();
    });
    el.missingLetterReplayBtn.addEventListener('click', speakCurrentWord);
    el.memoryGrid.addEventListener('click', onMemoryGridClick);
    el.resultsReplayBtn.addEventListener('click', function () { startRound(state.mode); });
    el.resultsHomeBtn.addEventListener('click', function () {
      el.resultsScreen.hidden = true;
      renderHome();
    });
    el.gameHomeBtn.addEventListener('click', goHome);
  }

  function goHome() {
    if (state.advanceTimer) {
      clearTimeout(state.advanceTimer);
      state.advanceTimer = null;
    }
    if (state.wsFlashTimer) {
      clearTimeout(state.wsFlashTimer);
      state.wsFlashTimer = null;
    }
    if (state.memoryFlashTimer) {
      clearTimeout(state.memoryFlashTimer);
      state.memoryFlashTimer = null;
    }
    Speech.cancel();
    el.gameScreen.hidden = true;
    el.resultsScreen.hidden = true;
    renderHome();
  }

  function showLoadError() {
    el.loadError.hidden = false;
    el.loadError.textContent = 'No words loaded — check data/words.json';
    el.modeList.hidden = true;
  }

  function renderHome() {
    el.weekLabel.textContent = state.week ? 'Week of ' + state.week : '';
    renderStreak();
    renderStars();
    el.homeScreen.hidden = false;
  }

  function renderStreak() {
    var streak = state.progress.streak;
    el.streakDisplay.textContent = streak.count > 0
      ? '🔥 ' + streak.count + '-day streak'
      : 'Play today to start a streak!';
  }

  function renderStars() {
    ['hear-type', 'multiple-choice', 'unscramble', 'word-search', 'flash-card',
      'missing-letter', 'sentence-spell', 'memory-match'].forEach(function (mode) {
      var starEl = document.querySelector('[data-star-for="' + mode + '"]');
      var weekScores = state.progress.bestScores[state.week];
      var best = weekScores && weekScores[mode];
      starEl.hidden = best !== state.words.length;
    });
  }

  function onModeButtonClick(evt) {
    if (state.words.length === 0) return;
    var btn = evt.target.closest('.mode-btn');
    if (!btn) return;
    startRound(btn.getAttribute('data-mode'));
  }

  function startRound(mode) {
    state.mode = mode;
    state.order = shuffleWords(state.words);
    state.index = 0;
    state.results = [];
    el.homeScreen.hidden = true;
    el.resultsScreen.hidden = true;
    el.gameScreen.hidden = false;

    // Drop any stale interactive content left behind by a previous mode/round.
    el.mcOptions.innerHTML = '';
    state.unscrambleBuild = [];
    state.unscrambleBank = [];
    el.unscrambleBuild.innerHTML = '';
    el.unscrambleBank.innerHTML = '';
    if (state.wsFlashTimer) {
      clearTimeout(state.wsFlashTimer);
      state.wsFlashTimer = null;
    }
    el.wsGrid.innerHTML = '';
    el.wsWordList.innerHTML = '';
    if (state.memoryFlashTimer) {
      clearTimeout(state.memoryFlashTimer);
      state.memoryFlashTimer = null;
    }
    el.memoryGrid.innerHTML = '';

    el.hearTypePanel.hidden = mode !== 'hear-type' && mode !== 'sentence-spell';
    el.mcPanel.hidden = mode !== 'multiple-choice';
    el.unscramblePanel.hidden = mode !== 'unscramble';
    el.wsPanel.hidden = mode !== 'word-search';
    el.flashCardPanel.hidden = mode !== 'flash-card';
    el.missingLetterPanel.hidden = mode !== 'missing-letter';
    el.memoryMatchPanel.hidden = mode !== 'memory-match';

    if (mode === 'word-search') {
      setupWordSearch();
    } else if (mode === 'memory-match') {
      setupMemoryMatch();
    } else {
      showCurrentWord();
    }
  }

  function speakCurrentWord() {
    if (!Speech.isSupported()) return;
    var word = state.order[state.index];
    var style = state.speakCount % 2 === 0 ? 'word' : 'spelled';
    if (style === 'word' && state.mode === 'sentence-spell') {
      Speech.speak(buildSentencePrompt(word, state.sentences[word]));
    } else {
      Speech.speak(word, style);
    }
    state.speakCount++;
  }

  function showCurrentWord() {
    state.awaitingAdvance = false;
    el.feedback.textContent = '';
    el.gameProgress.textContent = 'Word ' + (state.index + 1) + ' of ' + state.order.length;
    var word = state.order[state.index];
    if (state.mode === 'hear-type' || state.mode === 'sentence-spell') {
      setupHearType(word);
    } else if (state.mode === 'multiple-choice') {
      setupMultipleChoice(word);
    } else if (state.mode === 'unscramble') {
      setupUnscramble(word);
    } else if (state.mode === 'flash-card') {
      setupFlashCard(word);
    } else if (state.mode === 'missing-letter') {
      setupMissingLetter(word);
    }
  }

  function setupHearType(word) {
    el.hearTypeInput.value = '';
    el.hearTypeHint.hidden = true;
    state.speakCount = 0;

    el.sentenceContext.hidden = state.mode !== 'sentence-spell';
    if (state.mode === 'sentence-spell') {
      var sentence = state.sentences[word];
      el.sentenceContext.textContent = sentence
        ? maskSentence(sentence, word)
        : 'Listen carefully — no example sentence yet for this word.';
    }

    if (Speech.isSupported()) {
      speakCurrentWord();
    } else {
      el.hearTypeHint.hidden = false;
      el.hearTypeHint.textContent =
        'Audio not supported on this browser — hint: ' + word.length + ' letters, starts with "' + word[0] + '"';
    }
    el.hearTypeInput.focus();
  }

  function setupMissingLetter(word) {
    el.missingLetterInput.value = '';
    el.missingLetterWord.textContent = maskWord(word);
    state.speakCount = 0;
    speakCurrentWord();
    el.missingLetterInput.focus();
  }

  function onMissingLetterSubmit() {
    if (state.awaitingAdvance) return;
    var word = state.order[state.index];
    recordAnswer(checkAnswer(el.missingLetterInput.value, word));
  }

  function setupMultipleChoice(word) {
    el.mcOptions.innerHTML = '';
    var distractors = generateDistractors(word, 3);
    var options = shuffleWords(distractors.concat([word]));
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mc-option';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        if (state.awaitingAdvance) return;
        recordAnswer(opt === word);
      });
      el.mcOptions.appendChild(btn);
    });
    state.speakCount = 0;
    speakCurrentWord();
  }

  function setupUnscramble(word) {
    state.unscrambleBuild = [];
    state.unscrambleBank = scrambleLetters(word);
    renderUnscrambleTiles();
    state.speakCount = 0;
    speakCurrentWord();
  }

  function renderUnscrambleTiles() {
    el.unscrambleBuild.innerHTML = '';
    el.unscrambleBank.innerHTML = '';

    state.unscrambleBuild.forEach(function (letter, i) {
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile tile-build';
      tile.textContent = letter;
      tile.addEventListener('click', function () {
        state.unscrambleBank.push(state.unscrambleBuild.splice(i, 1)[0]);
        renderUnscrambleTiles();
      });
      el.unscrambleBuild.appendChild(tile);
    });

    state.unscrambleBank.forEach(function (letter, i) {
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile tile-bank';
      tile.textContent = letter;
      tile.addEventListener('click', function () {
        state.unscrambleBuild.push(state.unscrambleBank.splice(i, 1)[0]);
        renderUnscrambleTiles();
      });
      el.unscrambleBank.appendChild(tile);
    });
  }

  function setupFlashCard(word) {
    state.flashCardFlipped = false;
    state.speakCount = 0;
    el.flashCardFront.hidden = false;
    el.flashCardBack.hidden = true;
    el.flashCardBack.textContent = word.toUpperCase();
    el.flashCardGrade.hidden = true;
  }

  function onFlashCardTap() {
    if (state.awaitingAdvance) return;
    speakCurrentWord();
    if (state.flashCardFlipped) return;
    state.flashCardFlipped = true;
    el.flashCardFront.hidden = true;
    el.flashCardBack.hidden = false;
    el.flashCardGrade.hidden = false;
  }

  function setupMemoryMatch() {
    state.memoryCards = buildMemoryDeck(state.words).map(function (card) {
      return { word: card.word, type: card.type, status: 'hidden' };
    });
    state.memoryFirstIndex = null;
    state.memoryMatchedCount = 0;
    state.memoryBusy = false;
    renderMemoryGrid();
    renderMemoryProgress();
  }

  function renderMemoryGrid() {
    el.memoryGrid.innerHTML = '';
    state.memoryCards.forEach(function (card, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memory-card';
      btn.dataset.index = i;
      el.memoryGrid.appendChild(btn);
    });
    state.memoryCards.forEach(function (card, i) { renderMemoryCard(i); });
  }

  function renderMemoryCard(i) {
    var card = state.memoryCards[i];
    var btn = el.memoryGrid.children[i];
    btn.classList.toggle('matched', card.status === 'matched');
    btn.classList.toggle('revealed', card.status === 'revealed');
    if (card.status === 'hidden') {
      btn.textContent = '❓';
    } else if (card.type === 'sound') {
      btn.textContent = '🔊';
    } else {
      btn.textContent = card.word.toUpperCase();
    }
  }

  function renderMemoryProgress() {
    el.gameProgress.textContent = 'Matched ' + state.memoryMatchedCount + ' of ' + state.words.length + ' pairs';
  }

  function onMemoryGridClick(evt) {
    if (state.memoryBusy) return;
    var btn = evt.target.closest('.memory-card');
    if (!btn) return;
    var i = Number(btn.dataset.index);
    var card = state.memoryCards[i];
    if (card.status !== 'hidden') return;

    card.status = 'revealed';
    renderMemoryCard(i);
    if (card.type === 'sound' && Speech.isSupported()) Speech.speak(card.word, 'word');

    if (state.memoryFirstIndex === null) {
      state.memoryFirstIndex = i;
      return;
    }

    var firstIndex = state.memoryFirstIndex;
    var first = state.memoryCards[firstIndex];
    state.memoryFirstIndex = null;

    if (first.word === card.word && first.type !== card.type) {
      first.status = 'matched';
      card.status = 'matched';
      renderMemoryCard(firstIndex);
      renderMemoryCard(i);
      state.memoryMatchedCount++;
      renderMemoryProgress();
      if (state.memoryMatchedCount === state.words.length) {
        state.order = state.words;
        state.results = state.words.map(function () { return true; });
        finishRound();
      }
    } else {
      state.memoryBusy = true;
      state.memoryFlashTimer = setTimeout(function () {
        first.status = 'hidden';
        card.status = 'hidden';
        renderMemoryCard(firstIndex);
        renderMemoryCard(i);
        state.memoryBusy = false;
      }, 800);
    }
  }

  function setupWordSearch() {
    state.wsFound = {};
    state.wsFirstCell = null;
    var built = buildWordSearchGrid(state.words);
    state.wsGrid = built.grid;
    renderWordSearchGrid();
    renderWordSearchWordList();
    renderWordSearchProgress();
  }

  function renderWordSearchGrid() {
    var size = state.wsGrid.length;
    el.wsGrid.innerHTML = '';
    el.wsGrid.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
    state.wsCellEls = [];
    state.wsGrid.forEach(function (rowLetters, row) {
      var rowEls = [];
      rowLetters.forEach(function (letter, col) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ws-cell';
        btn.textContent = letter;
        btn.addEventListener('click', function () { onWordSearchCellClick(row, col); });
        el.wsGrid.appendChild(btn);
        rowEls.push(btn);
      });
      state.wsCellEls.push(rowEls);
    });
  }

  function renderWordSearchWordList() {
    el.wsWordList.innerHTML = '';
    state.words.forEach(function (word) {
      var chip = document.createElement('span');
      chip.className = 'ws-word' + (state.wsFound[word] ? ' found' : '');
      chip.textContent = word;
      el.wsWordList.appendChild(chip);
    });
  }

  function renderWordSearchProgress() {
    var foundCount = Object.keys(state.wsFound).length;
    el.gameProgress.textContent = 'Found ' + foundCount + ' of ' + state.words.length;
  }

  function setWordSearchCellClass(cells, className, on) {
    cells.forEach(function (rc) {
      state.wsCellEls[rc[0]][rc[1]].classList.toggle(className, on);
    });
  }

  function onWordSearchCellClick(row, col) {
    if (!state.wsFirstCell) {
      state.wsFirstCell = [row, col];
      setWordSearchCellClass([[row, col]], 'selected', true);
      return;
    }

    var first = state.wsFirstCell;
    state.wsFirstCell = null;
    setWordSearchCellClass([first], 'selected', false);

    if (first[0] === row && first[1] === col) return; // tapped the same cell again — cancel

    var cells = getWordSearchLineCells(first[0], first[1], row, col);
    if (!cells) return; // not a straight line — ignore

    var match = matchWordSearchSelection(state.wsGrid, cells, state.words);
    if (match && !state.wsFound[match]) {
      state.wsFound[match] = true;
      setWordSearchCellClass(cells, 'found', true);
      el.feedback.textContent = '✅ Found "' + match + '"!';
      renderWordSearchWordList();
      renderWordSearchProgress();
      if (Object.keys(state.wsFound).length === state.words.length) {
        state.order = state.words;
        state.results = state.words.map(function () { return true; });
        finishRound();
      }
    } else {
      setWordSearchCellClass(cells, 'wrong', true);
      if (state.wsFlashTimer) clearTimeout(state.wsFlashTimer);
      state.wsFlashTimer = setTimeout(function () {
        setWordSearchCellClass(cells, 'wrong', false);
      }, 400);
    }
  }

  function onHearTypeSubmit() {
    if (state.awaitingAdvance) return;
    var word = state.order[state.index];
    recordAnswer(checkAnswer(el.hearTypeInput.value, word));
  }

  function recordAnswer(correct) {
    state.awaitingAdvance = true;
    state.results.push(correct);
    el.feedback.textContent = correct
      ? '✅ Correct!'
      : '❌ Not quite — it was "' + state.order[state.index] + '"';
    state.advanceTimer = setTimeout(advance, 900);
  }

  function advance() {
    state.index++;
    if (state.index >= state.order.length) {
      finishRound();
    } else {
      showCurrentWord();
    }
  }

  function finishRound() {
    var score = tallyScore(state.results);
    var today = toLocalDateString(new Date());
    state.progress = ProgressStore.recordBestScore(state.progress, state.week, state.mode, score.correct);
    state.progress.streak = updateStreak(state.progress.streak, today);
    ProgressStore.saveProgress(state.progress, window.localStorage);

    el.gameScreen.hidden = true;
    el.resultsScreen.hidden = false;
    el.resultsScore.textContent = score.correct + ' / ' + score.total;
    var missed = state.order.filter(function (w, i) { return !state.results[i]; });
    el.resultsMissed.textContent = missed.length ? 'Review: ' + missed.join(', ') : 'Perfect round! 🎉';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
