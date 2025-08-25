
export enum Page {
  Home,
  LevelSelection,
  Game,
  Settings
}

export enum Subject {
  Math = 'Matemática',
  Portuguese = 'Português'
}

export enum Level {
  One = 1,
  Two = 2
}

export interface Option {
  value: string;
  color: string;
  illustration?: string;
  alt?: string;
}

export interface Question {
  id: string;
  subject: Subject;
  level: Level;
  prompt: string;
  illustration: {
    src: string;
    alt: string;
  };
  options: Option[];
  correctAnswer: string;
  hint: string;
  celebrationMedia: {
    type: 'video' | 'gif';
    src: string;
    alt: string;
  };
}

export interface Settings {
  isTtsEnabled: boolean;
  isHighContrast: boolean;
  reduceMotion: boolean;
}
