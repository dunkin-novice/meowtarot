export const ASK_QUESTION_TOPICS = [
  {
    key: 'love',
    titleKey: 'topicLove',
    emoji: '💖',
    order: 1,
  },
  {
    key: 'finance',
    titleKey: 'topicFinance',
    emoji: '💰',
    order: 2,
  },
  {
    key: 'career',
    titleKey: 'topicCareer',
    emoji: '✨',
    order: 3,
  },
  {
    key: 'self',
    titleKey: 'topicSelf',
    emoji: '🌙',
    order: 4,
  },
  {
    key: 'family',
    titleKey: 'topicFamily',
    emoji: '🏡',
    order: 5,
  },
  {
    key: 'travel',
    titleKey: 'topicTravel',
    emoji: '✈️',
    order: 6,
  },
  {
    key: 'health',
    titleKey: 'topicHealth',
    emoji: '🌿',
    order: 7,
  },
  {
    key: 'other',
    titleKey: 'topicOther',
    emoji: '🔮',
    order: 8,
  },
];

const TOPIC_EMOJI_MAP = ASK_QUESTION_TOPICS.reduce((acc, topic) => {
  acc[topic.key] = topic.emoji;
  return acc;
}, {});

export function getAskQuestionTopics() {
  return ASK_QUESTION_TOPICS.slice().sort((a, b) => a.order - b.order);
}

export function getAskQuestionTopicIconMap() {
  return { ...TOPIC_EMOJI_MAP };
}
