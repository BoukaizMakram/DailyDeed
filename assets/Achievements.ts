export interface Achievement {
  id: string;
  title: string;
  description: string;
  message: string;
  icon: string;
  color: string;
  category: string;
  condition: {
    type: 'streak' | 'total_completed' | 'consecutive_days' | 'daily_goal' | 'app_shared' | 'deed_shared' | 'app_reviewed';
    value: number;
  };
  unlocked: boolean;
}

export const achievementsList: Achievement[] = [
  {
    id: 'first_deed',
    title: 'First Steps',
    description: 'Complete your first good deed',
    message: 'Congratulations on taking your first step towards doing good! Every journey begins with a single deed.',
    icon: 'star-outline',
    color: '#FFD700',
    category: 'Milestone',
    condition: { type: 'total_completed', value: 1 },
    unlocked: false
  },
  {
    id: 'goal_achiever',
    title: 'Goal Achiever',
    description: 'Reach your daily goal',
    message: 'Excellent work! You\'ve reached your daily goal. Consistency like this builds lasting habits.',
    icon: 'checkmark-circle',
    color: '#32D74B',
    category: 'Daily',
    condition: { type: 'daily_goal', value: 1 },
    unlocked: false
  },
  {
    id: 'app_sharer',
    title: 'Kindness Ambassador',
    description: 'Share the Daily Deeds app',
    message: 'Thank you for spreading kindness! By sharing this app, you\'re helping others discover the joy of doing good.',
    icon: 'share-outline',
    color: '#007AFF',
    category: 'Community',
    condition: { type: 'app_shared', value: 1 },
    unlocked: false
  },
  {
    id: 'deed_sharer',
    title: 'Inspiration Spreader',
    description: 'Share a good deed story',
    message: 'Amazing! Your good deed story can inspire others to act with kindness. Keep spreading the positive vibes!',
    icon: 'heart-outline',
    color: '#FF3B30',
    category: 'Community',
    condition: { type: 'deed_shared', value: 1 },
    unlocked: false
  },
  {
    id: 'app_reviewer',
    title: 'Supportive Voice',
    description: 'Rate and review the app',
    message: 'Your feedback means the world! Thank you for helping make Daily Deeds better for everyone.',
    icon: 'star',
    color: '#FF9500',
    category: 'Community',
    condition: { type: 'app_reviewed', value: 1 },
    unlocked: false
  }
];