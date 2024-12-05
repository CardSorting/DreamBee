export interface Speaker {
  name: string;
  voiceId?: string;
  settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  customName?: string;
  gender?: 'male' | 'female';
  accent?: string;
  age?: number;
  role?: string;
}

export interface DialogueLine {
  speaker: Speaker;
  text: string;
  index: number;
  replyTo?: number;
  modifiers?: {
    emotion?: string;
    pace?: 'slow' | 'normal' | 'fast';
    volume?: 'soft' | 'normal' | 'loud';
    emphasis?: 'weak' | 'moderate' | 'strong';
  };
}

export interface SpeakerTimeline {
  lines: Array<{
    text: string;
    startTime: number;
    endTime: number;
    turnIndex: number;
  }>;
  totalDuration: number;
  wordCount: number;
}

export interface ConversationTranscript {
  metadata: {
    duration: number;
    speakers: string[];
    turnCount: number;
  };
  turns: Array<{
    index: number;
    speaker: string;
    text: string;
    startTime: number;
    endTime: number;
    words: Array<{
      word: string;
      startTime: number;
      endTime: number;
    }>;
    replyTo?: number;
  }>;
  speakerTranscripts: {
    [speaker: string]: SpeakerTimeline;
  };
}
