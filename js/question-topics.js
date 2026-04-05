import { buildAssetUrl } from './asset-config.js';

const TOPIC_ICON_PATHS = {
  love: 'assets/images/features/ask-a-question/icons/cat-love.webp',
  finance: 'assets/images/features/ask-a-question/icons/cat-finance.webp',
  career: 'assets/images/features/ask-a-question/icons/cat-career.webp',
  self: 'assets/images/features/ask-a-question/icons/cat-self.webp',
  family: 'assets/images/features/ask-a-question/icons/cat-family.webp',
  travel: 'assets/images/features/ask-a-question/icons/cat-travel.webp',
  health: 'assets/images/features/ask-a-question/icons/cat-health.webp',
  other: 'assets/images/features/ask-a-question/icons/cat-other.webp',
};

export const ASK_QUESTION_TOPICS = [
  {
    key: 'love',
    titleKey: 'topicLove',
    order: 1,
  },
  {
    key: 'finance',
    titleKey: 'topicFinance',
    order: 2,
  },
  {
    key: 'career',
    titleKey: 'topicCareer',
    order: 3,
  },
  {
    key: 'self',
    titleKey: 'topicSelf',
    order: 4,
  },
  {
    key: 'family',
    titleKey: 'topicFamily',
    order: 5,
  },
  {
    key: 'travel',
    titleKey: 'topicTravel',
    order: 6,
  },
  {
    key: 'health',
    titleKey: 'topicHealth',
    order: 7,
  },
  {
    key: 'other',
    titleKey: 'topicOther',
    order: 8,
  },
];

function resolveTopicIconPath(topicKey) {
  const path = TOPIC_ICON_PATHS[topicKey] || TOPIC_ICON_PATHS.other;
  return buildAssetUrl(path);
}

export function getAskQuestionTopics() {
  return ASK_QUESTION_TOPICS
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((topic) => ({
      ...topic,
      iconPath: resolveTopicIconPath(topic.key),
    }));
}

export function getAskQuestionTopicIconMap() {
  return { ...TOPIC_ICON_PATHS };
}