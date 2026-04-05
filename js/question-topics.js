import { buildAssetUrl } from './asset-config.js';

const TOPIC_ICON_PATHS = {
  love: 'icons/topics/cat-love.png',
  finance: 'icons/topics/cat-finance.png',
  career: 'icons/topics/cat-career.png',
  self: 'icons/topics/cat-self.png',
  family: 'icons/topics/cat-family.png',
  travel: 'icons/topics/cat-travel.png',
  health: 'icons/topics/cat-health.png',
  other: 'icons/topics/cat-other.png',
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
