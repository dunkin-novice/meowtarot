const LOCALES = ['en', 'th'];
const MODES = ['daily', 'question', 'full'];
const TOPICS = ['love', 'career', 'finance', 'self', 'family', 'travel', 'health', 'other', 'generic'];

const BASE_PROPERTIES = {
  locale: { type: 'string', enum: LOCALES, required: true, description: 'UI locale at event time.' },
  mode: { type: 'string', enum: MODES, required: false, description: 'Reading mode where the event occurred.' },
  topic: { type: 'string', enum: TOPICS, required: false, description: 'Reading topic where applicable.' },
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
