const PHASE_WINDOW = 10;
const MIN_READINGS_FOR_PHASE = 3;

const PHASE_META = Object.freeze({
  forming: { key: 'forming', labelKey: 'phase_forming_label', descriptionKey: 'phase_forming_desc' },
  rebuilding: { key: 'rebuilding', labelKey: 'phase_rebuilding_label', descriptionKey: 'phase_rebuilding_desc' },
  clarity: { key: 'clarity', labelKey: 'phase_clarity_label', descriptionKey: 'phase_clarity_desc' },
  emotional: { key: 'emotional', labelKey: 'phase_emotional_label', descriptionKey: 'phase_emotional_desc' },
  action: { key: 'action', labelKey: 'phase_action_label', descriptionKey: 'phase_action_desc' },
  transition: { key: 'transition', labelKey: 'phase_transition_label', descriptionKey: 'phase_transition_desc' },
});

function clampRatio(value, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function isMajorFromId(cardId = '') {
  const match = String(cardId || '').match(/^(\d{1,2})-/);
  if (!match) return false;
  const num = Number(match[1]);
  return Number.isFinite(num) && num >= 1 && num <= 22;
}

function detectSuit(cardId = '') {
  const id = String(cardId || '').toLowerCase();
  if (id.includes('-cups')) return 'cups';
  if (id.includes('-swords')) return 'swords';
  if (id.includes('-pentacles')) return 'pentacles';
  if (id.includes('-wands')) return 'wands';
  return 'unknown';
}

function resolveProgressState(state = null) {
  if (state?.progress && typeof state.progress === 'object') return state.progress;
  if (state && typeof state === 'object') return state;
  return {};
}

function getSuitDominance(stats) {
  const suits = ['cups', 'swords', 'pentacles', 'wands'];
  const ranked = suits
    .map((key) => ({ key, value: stats.suits[key] || 0 }))
    .sort((a, b) => b.value - a.value);
  return {
    top: ranked[0],
    second: ranked[1],
  };
}

function computeStats(readings = []) {
  const total = readings.length;
  const stats = {
    total,
    reversed: 0,
    major: 0,
    suits: { cups: 0, swords: 0, pentacles: 0, wands: 0 },
  };

  readings.forEach((entry) => {
    if (entry.orientation === 'reversed') stats.reversed += 1;
    if (isMajorFromId(entry.id)) stats.major += 1;
    const suit = detectSuit(entry.id);
    if (stats.suits[suit] != null) stats.suits[suit] += 1;
  });

  const reversedRatio = clampRatio(stats.reversed / Math.max(total, 1));
  const majorRatio = clampRatio(stats.major / Math.max(total, 1));
  const suitDominance = getSuitDominance(stats);
  const topSuitRatio = clampRatio((suitDominance.top?.value || 0) / Math.max(total, 1));
  const topSuitLead = clampRatio(((suitDominance.top?.value || 0) - (suitDominance.second?.value || 0)) / Math.max(total, 1));

  return {
    ...stats,
    reversedRatio,
    majorRatio,
    topSuit: suitDominance.top?.key || 'unknown',
    topSuitRatio,
    topSuitLead,
  };
}

function scorePhases(stats) {
  const scores = {
    rebuilding: 0,
    clarity: 0,
    emotional: 0,
    action: 0,
    transition: 0,
  };

  const uprightRatio = 1 - stats.reversedRatio;
  const swordsPentaclesRatio = (stats.suits.swords + stats.suits.pentacles) / Math.max(stats.total, 1);
  const suits = stats.suits;

  if (stats.reversedRatio >= 0.55) scores.rebuilding += 2;
  if (swordsPentaclesRatio >= 0.45) scores.rebuilding += 1;
  if (stats.majorRatio <= 0.2) scores.rebuilding += 1;

  if (stats.reversedRatio >= 0.35 && stats.reversedRatio <= 0.6) scores.clarity += 1;
  if (stats.majorRatio >= 0.2 && stats.majorRatio <= 0.45) scores.clarity += 1;
  if (stats.topSuitLead <= 0.2) scores.clarity += 2;

  if (stats.topSuit === 'cups' && stats.topSuitRatio >= 0.35) scores.emotional += 2;
  if (stats.reversedRatio >= 0.25 && stats.reversedRatio <= 0.65) scores.emotional += 1;
  if (stats.majorRatio <= 0.4) scores.emotional += 1;

  if (stats.topSuit === 'wands' && stats.topSuitRatio >= 0.35) scores.action += 2;
  if (uprightRatio >= 0.6) scores.action += 1;
  if (stats.majorRatio <= 0.35) scores.action += 1;

  if (stats.majorRatio >= 0.35) scores.transition += 2;
  if (stats.reversedRatio >= 0.35 && stats.reversedRatio <= 0.65) scores.transition += 1;
  if (stats.topSuitLead <= 0.18) scores.transition += 1;

  const ranked = Object.entries(scores)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);

  return {
    scores,
    best: ranked[0] || { key: 'clarity', value: 0 },
    second: ranked[1] || { key: 'clarity', value: 0 },
  };
}

function buildPhaseResult(phaseKey, dict = {}, fallbackDict = {}) {
  const meta = PHASE_META[phaseKey] || PHASE_META.clarity;
  return {
    key: meta.key,
    label: dict[meta.labelKey] || fallbackDict[meta.labelKey] || '',
    description: dict[meta.descriptionKey] || fallbackDict[meta.descriptionKey] || '',
  };
}

export function getRecentDailyReadings(state) {
  const progress = resolveProgressState(state);
  const source = Array.isArray(progress?.recent_daily_cards) ? progress.recent_daily_cards : [];
  return source
    .map((entry) => ({
      date: String(entry?.date || ''),
      id: String(entry?.id || ''),
      orientation: String(entry?.orientation || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright',
    }))
    .filter((entry) => entry.date && entry.id)
    .slice(-PHASE_WINDOW);
}

export function computePhase(state, dict = {}, fallbackDict = {}) {
  const recent = getRecentDailyReadings(state);
  if (recent.length < MIN_READINGS_FOR_PHASE) {
    return buildPhaseResult('forming', dict, fallbackDict);
  }

  const stats = computeStats(recent);
  const ranking = scorePhases(stats);

  const weakLead = ranking.best.value - ranking.second.value <= 0;
  const phaseKey = weakLead ? 'transition' : ranking.best.key;
  return buildPhaseResult(phaseKey, dict, fallbackDict);
}
