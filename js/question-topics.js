export const ASK_QUESTION_TOPICS = [
  {
    key: 'love',
    titleKey: 'topicLove',
    descriptionKey: 'topicLoveDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-love.webp',
  },
  {
    key: 'finance',
    titleKey: 'topicFinance',
    descriptionKey: 'topicFinanceDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-finance.webp',
  },
  {
    key: 'career',
    titleKey: 'topicCareer',
    descriptionKey: 'topicCareerDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-career.webp',
  },
  {
    key: 'other',
    titleKey: 'topicOther',
    descriptionKey: 'topicOtherDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-other.webp',
  },
  {
    key: 'health',
    titleKey: 'topicHealth',
    descriptionKey: 'topicHealthDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-health.webp',
  },
  {
    key: 'family',
    titleKey: 'topicFamily',
    descriptionKey: 'topicFamilyDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-family.webp',
  },
  {
    key: 'travel',
    titleKey: 'topicTravel',
    descriptionKey: 'topicTravelDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-travel.webp',
  },
  {
    key: 'self',
    titleKey: 'topicSelf',
    descriptionKey: 'topicSelfDesc',
    icon: 'assets/images/features/ask-a-question/icons/cat-self.webp',
  },
];

export function getAskQuestionTopics() {
  return ASK_QUESTION_TOPICS.map((topic) => ({ ...topic }));
}
