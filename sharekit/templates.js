/*
 * Optional templates and helpers for Share Kit
 */

const ShareKitDefaults = {
  baseUrl: 'https://meowtarot.com',
  watermarkText: 'meowtarot.com',
  theme: {
    gradient: { from: '#140f24', to: '#302b63', direction: 'vertical' },
    titleColor: '#ffffff',
    subtitleColor: 'rgba(255,255,255,0.8)',
    summaryColor: 'rgba(255,255,255,0.95)',
    watermarkColor: 'rgba(255,255,255,0.7)',
    cardLabelColor: 'rgba(255,255,255,0.85)',
  },
};

const ShareKitDemoResult = {
  appTitle: 'MeowTarot',
  readingType: 'Single Card Draw',
  completedAt: new Date().toISOString(),
  showDate: true,
  showNames: true,
  summary: 'The Magician signals focus and power. Use clear intent to shape today\'s outcome.',
  shareUrl: 'https://meowtarot.com/reading/demo?utm_source=share&utm_medium=demo',
  cards: [
    {
      name: 'The Magician',
      image: 'https://meowtarot.com/assets/cards/the-magician.jpg',
    },
  ],
};

window.ShareKitDefaults = ShareKitDefaults;
window.ShareKitDemoResult = ShareKitDemoResult;
