export const ASK_QUESTION_TOPICS = [
  {
    key: 'love',
    titleKey: 'topicLove',
    descriptionKey: 'topicLoveDesc',
    icon: '❤',
  },
  {
    key: 'finance',
    titleKey: 'topicFinance',
    descriptionKey: 'topicFinanceDesc',
    icon: '✦',
  },
  {
    key: 'career',
    titleKey: 'topicCareer',
    descriptionKey: 'topicCareerDesc',
    icon: '☽',
  },
  {
    key: 'other',
    titleKey: 'topicOther',
    descriptionKey: 'topicOtherDesc',
    icon: '✧',
  },
];

export function getAskQuestionTopics() {
  return ASK_QUESTION_TOPICS.map((topic) => ({ ...topic }));
}
