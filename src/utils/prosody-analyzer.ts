interface ProsodyContext {
  previousLine?: string | null;
  nextLine?: string | null;
  speakerChange?: boolean;
}

interface ProsodyCharacteristics {
  pace?: number;
  naturalness?: number;
}

interface ProsodyModifications {
  prePause?: number;
  postPause?: number;
  intonationCurve?: {
    direction: 'rising' | 'falling' | 'flat';
    intensity?: number;
  };
}

interface ProsodyAnalysis {
  characteristics?: ProsodyCharacteristics;
  modifications?: ProsodyModifications;
}

export class ProsodyAnalyzer {
  private apiKey: string;

  constructor(anthropicApiKey: string) {
    this.apiKey = anthropicApiKey;
  }

  async analyzeSpeechPattern(
    text: string,
    context: ProsodyContext = {}
  ): Promise<ProsodyAnalysis> {
    // For now, return a simplified analysis
    // In production, this would use the Anthropic API
    return {
      characteristics: {
        pace: this.calculatePace(text),
        naturalness: this.calculateNaturalness(text, context)
      },
      modifications: {
        prePause: this.calculatePrePause(text, context),
        postPause: this.calculatePostPause(text, context),
        intonationCurve: this.determineIntonation(text)
      }
    };
  }

  private calculatePace(text: string): number {
    // Base pace calculation on sentence structure and punctuation
    const words = text.split(/\s+/).length;
    const punctuation = (text.match(/[,.!?;]/g) || []).length;
    
    // More punctuation suggests a slower pace
    const basePace = 1.0;
    const paceModifier = Math.max(0.8, 1 - (punctuation / words) * 0.5);
    
    return basePace * paceModifier;
  }

  private calculateNaturalness(text: string, context: ProsodyContext): number {
    // Higher naturalness for contextually appropriate responses
    let naturalness = 0.8; // Base naturalness

    if (context.previousLine) {
      // Check for natural flow between lines
      const prevWords = context.previousLine.toLowerCase().split(/\s+/);
      const currentWords = text.toLowerCase().split(/\s+/);
      const hasCommonWords = prevWords.some(w => currentWords.includes(w));
      
      if (hasCommonWords) {
        naturalness += 0.1;
      }
    }

    // Adjust for very short or long responses
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 3 || wordCount > 20) {
      naturalness -= 0.1;
    }

    return Math.max(0.5, Math.min(naturalness, 1.0));
  }

  private calculatePrePause(text: string, context: ProsodyContext): number {
    let pause = 0.2; // Base pause

    // Longer pause after speaker change
    if (context.speakerChange) {
      pause += 0.1;
    }

    // Longer pause for questions
    if (context.previousLine?.endsWith('?')) {
      pause += 0.1;
    }

    return Math.min(pause, 0.5);
  }

  private calculatePostPause(text: string, context: ProsodyContext): number {
    let pause = 0.2; // Base pause

    // Longer pause before speaker change
    if (context.speakerChange) {
      pause += 0.1;
    }

    // Longer pause after questions or exclamations
    if (text.endsWith('?') || text.endsWith('!')) {
      pause += 0.1;
    }

    return Math.min(pause, 0.5);
  }

  private determineIntonation(text: string): { direction: 'rising' | 'falling' | 'flat'; intensity?: number } {
    // Determine intonation based on sentence type and punctuation
    if (text.endsWith('?')) {
      return { direction: 'rising', intensity: 0.8 };
    } else if (text.endsWith('!')) {
      return { direction: 'falling', intensity: 0.9 };
    } else if (text.endsWith('...')) {
      return { direction: 'flat', intensity: 0.3 };
    } else {
      return { direction: 'falling', intensity: 0.5 };
    }
  }
}
