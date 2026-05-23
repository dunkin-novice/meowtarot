import { initShell } from './common.js?v=20260523';

const state = {
  currentLang: 'en',
};

function init() {
  initShell(state, null, 'home');
}

document.addEventListener('DOMContentLoaded', init);
