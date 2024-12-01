interface Speaker {
  name: string;
  voiceId: string;
  settings?: {
    stability: number;
    similarity_boost: number;
  };
}

interface DialogueLine {
  speaker: Speaker;
  text: string;
  index: number;  // Position in conversation
  replyTo?: number;  // Index of the line this is replying to
}

interface ConversationSegment {
  speaker: Speaker;
  text: string;
  startTime: number;
  endTime: number;
  timestamps: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

interface ConversationTranscript {
  metadata: {
    duration: number;
    speakers: string[];
    turnCount: number;
  };
  turns: {
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
  }[];
  speakerTranscripts: {
    [speaker: string]: {
      lines: Array<{
        text: string;
        startTime: number;
        endTime: number;
        turnIndex: number;
      }>;
      totalDuration: number;
      wordCount: number;
    };
  };
}

export class ConversationManager {
  private speakers: Map<string, Speaker> = new Map();
  private dialogue: DialogueLine[] = [];

  constructor(speakers: Speaker[]) {
    speakers.forEach(speaker => {
      this.speakers.set(speaker.name.toLowerCase(), speaker);
    });
  }

  private getSpeakerNames(): string[] {
    const names: string[] = [];
    this.speakers.forEach((_, key) => names.push(key));
    return names;
  }

  parseConversation(text: string): DialogueLine[] {
    // Parse format like "[adam] hello how are you? [sarah] I'm good!"
    const lines = text.split(/\[([^\]]+)\]\s*([^[]+)/).filter(Boolean);
    const dialogue: DialogueLine[] = [];
    
    for (let i = 0; i < lines.length; i += 2) {
      const speakerName = lines[i].trim().toLowerCase();
      const text = lines[i + 1].trim();
      
      const speaker = this.speakers.get(speakerName);
      if (!speaker) {
        throw new Error(`Unknown speaker: ${lines[i]}`);
      }

      dialogue.push({
        speaker,
        text,
        index: dialogue.length,
        replyTo: dialogue.length > 0 ? dialogue.length - 1 : undefined
      });
    }

    this.dialogue = dialogue;
    return dialogue;
  }

  generateTranscript(segments: ConversationSegment[]): ConversationTranscript {
    const speakerNames = this.getSpeakerNames();
    const transcript: ConversationTranscript = {
      metadata: {
        duration: Math.max(...segments.map(s => s.endTime)),
        speakers: speakerNames,
        turnCount: segments.length
      },
      turns: [],
      speakerTranscripts: {}
    };

    // Initialize speaker transcripts
    speakerNames.forEach(speaker => {
      transcript.speakerTranscripts[speaker] = {
        lines: [],
        totalDuration: 0,
        wordCount: 0
      };
    });

    // Process each segment
    segments.forEach((segment, index) => {
      const text = segment.timestamps.characters.join('');
      const words = text.trim().split(/\s+/);
      const wordTimings = [];
      let wordStartIndex = 0;

      // Calculate word timings
      for (const word of words) {
        const wordStartInText = text.indexOf(word, wordStartIndex);
        const wordEndInText = wordStartInText + word.length;
        
        const startTime = segment.timestamps.character_start_times_seconds[wordStartInText];
        const endTime = segment.timestamps.character_end_times_seconds[wordEndInText - 1];
        
        wordTimings.push({
          word,
          startTime,
          endTime
        });
        
        wordStartIndex = wordEndInText;
      }

      // Add to turns
      const turn = {
        index,
        speaker: segment.speaker.name,
        text: text.trim(),
        startTime: segment.startTime,
        endTime: segment.endTime,
        words: wordTimings,
        replyTo: index > 0 ? index - 1 : undefined
      };
      transcript.turns.push(turn);

      // Add to speaker transcript
      const speakerTranscript = transcript.speakerTranscripts[segment.speaker.name.toLowerCase()];
      speakerTranscript.lines.push({
        text: text.trim(),
        startTime: segment.startTime,
        endTime: segment.endTime,
        turnIndex: index
      });
      speakerTranscript.totalDuration += segment.endTime - segment.startTime;
      speakerTranscript.wordCount += words.length;
    });

    return transcript;
  }

  generateSpeakerTimeline(transcript: ConversationTranscript, speaker: string): string {
    const speakerData = transcript.speakerTranscripts[speaker.toLowerCase()];
    if (!speakerData) {
      throw new Error(`No transcript data for speaker: ${speaker}`);
    }

    let timeline = `Timeline for ${speaker}:\n\n`;
    speakerData.lines.forEach((line, index) => {
      const turn = transcript.turns[line.turnIndex];
      const replyingTo = turn.replyTo !== undefined ? 
        transcript.turns[turn.replyTo].speaker : 'conversation start';

      timeline += `[${formatTime(line.startTime)} - ${formatTime(line.endTime)}]\n`;
      timeline += `Replying to: ${replyingTo}\n`;
      timeline += `Text: ${line.text}\n\n`;
    });

    timeline += `\nSummary:\n`;
    timeline += `Total speaking time: ${formatTime(speakerData.totalDuration)}\n`;
    timeline += `Word count: ${speakerData.wordCount}\n`;
    timeline += `Average words per turn: ${(speakerData.wordCount / speakerData.lines.length).toFixed(1)}\n`;

    return timeline;
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(2);
  return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
}

export function parseConversationText(text: string): { speaker: string; text: string }[] {
  return text
    .split(/\[([^\]]+)\]\s*([^[]+)/)
    .filter(Boolean)
    .reduce((acc, curr, i, arr) => {
      if (i % 2 === 0) {
        acc.push({
          speaker: curr.trim(),
          text: arr[i + 1]?.trim() || ''
        });
      }
      return acc;
    }, [] as { speaker: string; text: string }[]);
}
