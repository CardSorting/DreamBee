interface DialogueContext {
  emotionalTone?: string;
  topicContinuity?: number;
  turnTakingDynamics?: {
    isDelayedResponse?: boolean;
    isDirectResponse?: boolean;
  };
  prosodyMarkers?: {
    emphasis?: number;
  };
}

interface DialogueAnalysis {
  context?: DialogueContext;
}

export class DialogueAnalyzer {
  private apiKey: string;

  constructor(anthropicApiKey: string) {
    this.apiKey = anthropicApiKey;
  }

  async analyzeLine(
    currentLine: string,
    previousLine?: string | null,
    nextLine?: string | null,
    speakerChange?: boolean
  ): Promise<DialogueAnalysis> {
    // For now, return a simplified analysis
    // In production, this would use the Anthropic API
    return {
      context: {
        emotionalTone: this.detectEmotionalTone(currentLine),
        topicContinuity: previousLine ? this.calculateTopicContinuity(currentLine, previousLine) : 1,
        turnTakingDynamics: {
          isDelayedResponse: false,
          isDirectResponse: previousLine ? this.isDirectResponse(currentLine, previousLine) : false
        },
        prosodyMarkers: {
          emphasis: this.calculateEmphasis(currentLine)
        }
      }
    };
  }

  private detectEmotionalTone(text: string): string {
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    const words = text.toLowerCase().split(/\s+/);
    
    // Simple emotion detection based on punctuation and keywords
    if (exclamationCount > 0) {
      return 'excited';
    } else if (questionCount > 0) {
      return 'contemplative';
    } else if (words.some(w => ['sad', 'sorry', 'unfortunately'].includes(w))) {
      return 'sad';
    } else if (words.some(w => ['angry', 'upset', 'frustrated'].includes(w))) {
      return 'angry';
    }
    
    return 'neutral';
  }

  private calculateTopicContinuity(current: string, previous: string): number {
    const currentWords = current.toLowerCase().split(/\s+/);
    const previousWords = previous.toLowerCase().split(/\s+/);
    
    // Calculate word overlap using arrays instead of Sets
    const intersection = currentWords.filter(word => previousWords.includes(word));
    const union = Array.from(new Set([...currentWords, ...previousWords]));
    
    return intersection.length / union.length;
  }

  private isDirectResponse(current: string, previous: string): boolean {
    const previousWords = previous.toLowerCase().split(/\s+/);
    const currentWords = current.toLowerCase().split(/\s+/);
    
    // Check if current line references previous line
    return previousWords.some(word => 
      currentWords.includes(word) || 
      currentWords.some(w => w.includes(word) || word.includes(w))
    );
  }

  private calculateEmphasis(text: string): number {
    const exclamationCount = (text.match(/!/g) || []).length;
    const capsCount = (text.match(/[A-Z]{2,}/g) || []).length;
    const words = text.split(/\s+/).length;
    
    // Calculate emphasis score (0-1)
    return Math.min(1, (exclamationCount + capsCount) / words);
  }
}
