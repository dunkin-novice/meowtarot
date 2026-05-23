import { initShell } from './common.js';

const state = { currentLang: 'en' };

document.addEventListener('DOMContentLoaded', () => {
  initShell(state, null, 'home');
});
