import { initShell } from './common.js';

const state = {
  currentLang: 'en',
};

function init() {
  initShell(state, null, 'home');
}

document.addEventListener('DOMContentLoaded', init);
