const LOCALES = ['en', 'th'];
const MODES = ['daily', 'question', 'full'];
const TOPICS = ['love', 'career', 'finance', 'self', 'family', 'travel', 'health', 'other', 'generic'];

const BASE_PROPERTIES = {
  locale: { type: 'string', enum: LOCALES, required: true, description: 'UI locale at event time.' },
  mode: { type: 'string', enum: MODES, required: false, description: 'Reading mode where the event occurred.' },
  topic: { type: 'string', enum: TOPICS, required: false, description: 'Reading topic where applicable.' },
  session_id: { type: 'string', required: false, description: 'Stable per-device analytics session id.' },
  user_id: { type: 'string', required: false, description: 'Supabase profile UUID when signed in, otherwise anon.' },
};

export const EVENT_TRACKING_SCHEMA = {
  reading_start: {
    description: 'Fired when a reading session is initialized and cards are available.',
    required: ['locale', 'mode'],
    properties: {
      ...BASE_PROPERTIES,
    },
  },
  reading_complete: {
    description: 'Fired once a reading is fully rendered and user reaches completion state.',
    required: ['locale', 'mode'],
    properties: {
      ...BASE_PROPERTIES,
      card_count: { type: 'number', required: false, description: 'Number of cards shown in the completed reading.' },
    },
  },
  reading_completed_raw: {
    description: 'Raw reading completion log for all reading features; additive to reading_complete.',
    required: ['feature', 'locale', 'card_count', 'cards', 'session_id', 'user_id'],
    properties: {
      ...BASE_PROPERTIES,
      feature: { type: 'string', enum: MODES, required: true, description: 'Reading feature completed.' },
      card_count: { type: 'number', required: true, description: 'Number of cards in the completed reading.' },
      cards: { type: 'string', required: true, description: 'Comma-separated slug-orientation card tokens, truncated at 100 chars for GA4.' },
      cards_truncated: { type: 'boolean', required: true, description: 'Whether cards field was truncated.' },
      duration_ms: { type: 'number', required: true, description: 'Client-observed milliseconds from reading_start to completion.' },
    },
  },
  daily_streak_incremented: {
    description: 'Fired when daily streak increments from a daily reading completion.',
    required: ['locale', 'streak_day_count', 'session_id', 'user_id'],
    properties: {
      ...BASE_PROPERTIES,
      streak_day_count: { type: 'number', required: true, description: 'Updated daily streak count after increment.' },
    },
  },
  topic_selected: {
    description: 'Fired when user picks a reading topic.',
    required: ['locale', 'mode', 'topic'],
    properties: {
      ...BASE_PROPERTIES,
    },
  },
  share_clicked: {
    description: 'Fired whenever a share CTA is clicked from a reading context.',
    required: ['locale'],
    properties: {
      ...BASE_PROPERTIES,
      share_channel: { type: 'string', required: false, description: 'Resolved share channel (copy_link, share_page, etc).' },
    },
  },
  locale_switched: {
    description: 'Fired when user changes locale.',
    required: ['from_locale', 'to_locale'],
    properties: {
      ...BASE_PROPERTIES,
      from_locale: { type: 'string', enum: LOCALES, required: true, description: 'Previous locale.' },
      to_locale: { type: 'string', enum: LOCALES, required: true, description: 'New locale.' },
    },
  },
  profile_revisit: {
    description: 'Fired when a returning user revisits the profile view.',
    required: ['locale', 'profile_id'],
    properties: {
      ...BASE_PROPERTIES,
      profile_id: { type: 'string', required: true, description: 'Stable profile identifier or guest marker.' },
    },
  },
};

export function getEventSchema(eventName) {
  return EVENT_TRACKING_SCHEMA[eventName] || null;
}

export function listTrackingEvents() {
  return Object.keys(EVENT_TRACKING_SCHEMA);
}
