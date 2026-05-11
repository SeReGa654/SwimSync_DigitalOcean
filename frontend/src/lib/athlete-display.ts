export function toGenderUa(gender: string | null | undefined): string {
  const value = (gender || '').trim().toUpperCase();
  if (value === 'M') return 'Ч';
  if (value === 'F') return 'Ж';
  if (value === 'X') return 'Змішана';
  return gender?.trim() || '—';
}

export function toRankUa(rank: string | null | undefined): string {
  const value = (rank || '').trim().toUpperCase();
  if (!value || value === 'NONE') return '—';

  const mapping: Record<string, string> = {
    MSMK: 'МСМК',
    MS: 'МС',
    KMS: 'КМС',
    KMSU: 'КМСУ',
    R1: 'І',
    R2: 'ІІ',
    R3: 'ІІІ',
    Y1: 'І юн.',
    Y2: 'ІІ юн.',
    Y3: 'ІІІ юн.',
  };

  return mapping[value] || rank!.trim();
}
