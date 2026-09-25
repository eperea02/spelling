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

  function speak(word, style) {
    if (!isSupported()) return false;
    window.speechSynthesis.cancel();
    var text = style === 'spelled' ? spellOutWord(word) : word;
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.65;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function cancel() {
    if (isSupported()) window.speechSynthesis.cancel();
  }

  return { isSupported: isSupported, speak: speak, cancel: cancel };
})();
