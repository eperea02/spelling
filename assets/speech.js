// assets/speech.js
// Wraps the browser's Web Speech API so the rest of the app never touches
// `window.speechSynthesis` directly. Browser-only — not loaded in Node tests.
// Browser: exposes a global `Speech` object built by an IIFE. No Node export.

var Speech = (function () {
  function isSupported() {
    return typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined';
  }

  function queueUtterance(text, rate) {
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  // style: undefined/'word' speaks it plainly; 'spelled' names each letter
  // ("F. L. I. P. P. E. D."); 'sounded-out' speaks it broken into syllable
  // chunks ("flip. ping.") at a slower rate, for a young reader decoding it.
  function speakOne(text, style) {
    if (style === 'spelled') {
      queueUtterance(spellOutWord(text), 0.65);
    } else if (style === 'sounded-out') {
      queueUtterance(splitIntoSyllables(text).join('. ') + '.', 0.45);
    } else {
      queueUtterance(text, 0.65);
    }
  }

  function speak(word, style) {
    if (!isSupported()) return false;
    window.speechSynthesis.cancel();
    speakOne(word, style);
    return true;
  }

  // Speaks several parts in sequence (e.g. word, then a sentence at normal
  // pace, then the word again) without cancelling between them, so they
  // play back to back as one logical utterance. Each part is
  // { text, style }; style follows the same rules as speak()'s style arg.
  function speakSequence(parts) {
    if (!isSupported()) return false;
    window.speechSynthesis.cancel();
    parts.forEach(function (part) { speakOne(part.text, part.style); });
    return true;
  }

  function cancel() {
    if (isSupported()) window.speechSynthesis.cancel();
  }

  return { isSupported: isSupported, speak: speak, speakSequence: speakSequence, cancel: cancel };
})();
