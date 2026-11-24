export interface MeditationContent {
  id: string;
  title: string;
  description: string;
  audioPath: string;
  background: string;
  cues: readonly { atSeconds: number; text: string }[];
  minimumSeconds: number;
  source: { title: string; url: string; audioUrl: string; credit: string; licenseUrl: string };
}

export const meditationContents: readonly MeditationContent[] = [
  {
    id: 'korean-body-scan',
    title: '바디스캔 명상',
    description: '한국어 안내 음성을 들으며 몸의 감각을 차례로 살펴봐요.',
    audioPath: '/audio/meditation/korean-bodyscan.mp3',
    background: 'bg-current/5',
    minimumSeconds: 180,
    cues: [
      { atSeconds: 0, text: '편한 자세로 자리를 잡아요.' },
      { atSeconds: 27, text: '호흡이 오가는 속도를 그대로 두어요.' },
      { atSeconds: 73, text: '발과 다리가 받쳐지는 느낌을 살펴봐요.' },
      { atSeconds: 116, text: '몸통의 작은 감각에도 잠시 머물러요.' },
      { atSeconds: 163, text: '이제 손끝과 팔 쪽으로 주의를 옮겨요.' },
      { atSeconds: 211, text: '턱과 어깨를 편안하게 놓아줘요.' },
      { atSeconds: 243, text: '몸 전체를 느끼며 호흡으로 돌아와요.' },
    ],
    source: {
      title: 'UCLA Mindful — Korean Short Body Scan',
      url: 'https://www.uclahealth.org/uclamindful/guided-meditations',
      audioUrl: 'https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/Korean-bodyscan.mp3',
      credit:
        'Diana Winston (원작) · Jooli Park (한국어 번역) · © 2011–2024 The Regents of the University of California',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
    },
  },
];
