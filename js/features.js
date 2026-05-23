import { initShell } from './common.js?v=20260523';

const state = { currentLang: 'en' };

document.addEventListener('DOMContentLoaded', () => {
  initShell(state, null, 'home');
});
