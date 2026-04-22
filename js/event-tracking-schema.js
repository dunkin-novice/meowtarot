const LOCALES = ['en', 'th'];
const MODES = ['daily', 'question', 'full'];
const SPREADS = ['single', 'story', 'celtic'];
const TOPICS = ['love', 'career', 'finance', 'self', 'family', 'travel', 'health', 'other', 'generic'];

const BASE_PROPERTIES = {
  event_id: { type: 'string', required: true, description: 'Client-generated UUID for deduplication.' },
  session_id: { type: 'string', required: true, description: 'Anonymous session identifier.' },
  user_id: { type: 'string', required: false, description: 'Logged-in user id, if available.' },
  timestamp: { type: 'string', format: 'date-time', required: true, description: 'UTC event timestamp (ISO-8601).' },
  locale: { type: 'string', enum: LOCALES, required: true, description: 'UI locale at event time.' },
  platform: { type: 'string', required: false, description: 'Client platform (web, ios, android).' },
};

export const EVENT_TRACKING_SCHEMA = {
  reading_start: {
    description: 'Fired when a reading session is initialized and cards are available.',
    required: ['event_id', 'session_id', 'timestamp', 'locale', 'mode', 'spread'],
    properties: {
      ...BASE_PROPERTIES,
      mode: { type: 'string', enum: MODES, required: true, description: 'Reading mode.' },
      spread: { type: 'string', enum: SPREADS, required: true, description: 'Spread layout.' },
      topic: { type: 'string', enum: TOPICS, required: false, description: 'Question topic if selected.' },
      entry_path: { type: 'string', required: false, description: 'Path that initiated reading.' },
      card_ids: { type: 'array', items: { type: 'string' }, required: false, description: 'Selected card ids.' },
    },
  },
  reading_complete: {
    description: 'Fired once a reading is fully rendered and user reaches completion state.',
    required: ['event_id', 'session_id', 'timestamp', 'locale', 'mode', 'spread', 'duration_ms'],
    properties: {
      ...BASE_PROPERTIES,
      mode: { type: 'string', enum: MODES, required: true, description: 'Reading mode.' },
      spread: { type: 'string', enum: SPREADS, required: true, description: 'Spread layout.' },
      topic: { type: 'string', enum: TOPICS, required: false, description: 'Question topic if selected.' },
      duration_ms: { type: 'number', required: true, description: 'Milliseconds from start to completion.' },
      card_count: { type: 'number', required: true, description: 'Number of cards in completed reading.' },
      completion_type: { type: 'string', required: false, description: 'How completion occurred (auto/manual).' },
    },
  },
  share_clicked: {
    description: 'Fired whenever the share CTA is clicked from a reading context.',
    required: ['event_id', 'session_id', 'timestamp', 'locale', 'share_surface'],
    properties: {
      ...BASE_PROPERTIES,
      mode: { type: 'string', enum: MODES, required: false, description: 'Reading mode where share was initiated.' },
      share_surface: { type: 'string', required: true, description: 'UI surface (reading_header, footer, modal).' },
      share_channel: { type: 'string', required: false, description: 'Resolved channel (native, copy_link, download).' },
      card_id: { type: 'string', required: false, description: 'Primary card id if sharing a single card.' },
    },
  },
  topic_selected: {
    description: 'Fired when user picks a reading topic.',
    required: ['event_id', 'session_id', 'timestamp', 'locale', 'topic'],
    properties: {
      ...BASE_PROPERTIES,
      topic: { type: 'string', enum: TOPICS, required: true, description: 'Current selected topic.' },
      previous_topic: { type: 'string', enum: TOPICS, required: false, description: 'Prior topic if one existed.' },
      mode: { type: 'string', enum: MODES, required: false, description: 'Mode where topic changed.' },
      source: { type: 'string', required: false, description: 'Selection source (chip, dropdown, deeplink).' },
    },
  },
  locale_switched: {
    description: 'Fired when user changes locale.',
    required: ['event_id', 'session_id', 'timestamp', 'from_locale', 'to_locale'],
    properties: {
      ...BASE_PROPERTIES,
      from_locale: { type: 'string', enum: LOCALES, required: true, description: 'Previous locale.' },
      to_locale: { type: 'string', enum: LOCALES, required: true, description: 'New locale.' },
      source: { type: 'string', required: false, description: 'Trigger location (navbar, footer, profile).' },
      path: { type: 'string', required: false, description: 'Current path when switch happened.' },
    },
  },
  profile_revisit: {
    description: 'Fired when a returning user revisits the profile view.',
    required: ['event_id', 'session_id', 'timestamp', 'locale', 'profile_id', 'days_since_last_visit'],
    properties: {
      ...BASE_PROPERTIES,
      profile_id: { type: 'string', required: true, description: 'Stable profile identifier.' },
      days_since_last_visit: { type: 'number', required: true, description: 'Whole/fractional days since previous profile view.' },
      revisit_count: { type: 'number', required: false, description: 'Total revisit count for the profile.' },
      entry_path: { type: 'string', required: false, description: 'Path user used to enter profile.' },
    },
  },
};

export function getEventSchema(eventName) {
  return EVENT_TRACKING_SCHEMA[eventName] || null;
}

export function listTrackingEvents() {
  return Object.keys(EVENT_TRACKING_SCHEMA);
}
