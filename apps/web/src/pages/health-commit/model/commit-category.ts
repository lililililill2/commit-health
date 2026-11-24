export interface CommitCategory {
  id: string;
  title: string;
  description: string;
}

export const commitCategories: readonly CommitCategory[] = [
  { id: 'sleep', title: '수면', description: '수면 시간, 취침·기상 시각의 규칙성' },
  { id: 'caffeine', title: '카페인', description: '오늘 마신 음료와 카페인 섭취량' },
  { id: 'meals', title: '식사', description: '아침·점심·저녁의 규칙성' },
  { id: 'running', title: '달리기', description: '달린 시간, 거리, 주간 활동 변화' },
  { id: 'focus', title: '집중', description: '집중 시간과 기록 추세' },
  { id: 'meditation', title: '명상', description: '명상한 횟수와 시간' },
  { id: 'stretching', title: '스트레칭', description: '실천 횟수와 시간' },
  { id: 'condition', title: '컨디션', description: '일별 컨디션 변화' },
];

export function getCommitCategory(id: string): CommitCategory | undefined {
  return commitCategories.find((category) => category.id === id);
}
