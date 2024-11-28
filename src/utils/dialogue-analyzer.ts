import Anthropic from '@anthropic-ai/sdk';

interface DialogueContext {
  emotionalTone: string;
  intentType: string;
  topicContinuity: number;  // 0-1 scale
  turnTakingDynamics: {
    isInterruption: boolean;
    isDelayedResponse: boolean;
    isDirectResponse: boolean;
    responseUrgency: number;  // 0-1 scale
  };
  prosodyMarkers: {
    emphasis: number;      // 0-1 scale
    intonation: string;   // rising, falling, flat
    tempo: string;        // slow, medium, fast
  };
  socialDynamics: {
    formality: number;    // 0-1 scale
    agreement: number;    // -1 to 1 scale
    dominance: number;    // -1 to 1 scale
  };
}

interface AnalysisResult {
  context: DialogueContext;
  suggestedPause: number;
  confidenceScore: number;
}

export class DialogueAnalyzer {
  private anthropic: Anthropic;
  private analysisCache: Map<string, AnalysisResult>;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });
    this.analysisCache = new Map();
  }

  private async analyzeWithClaude(
    currentLine: string,
    previousLine: string | null,
    nextLine: string | null,
    speakerChange: boolean
  ): Promise<DialogueContext> {
    const prompt = `
    Analyze this conversation segment for natural speech timing and dynamics:
    ${previousLine ? `Previous line: "${previousLine}"` : 'Start of conversation'}
    Current line: "${currentLine}"
    ${nextLine ? `Next line: "${nextLine}"` : 'End of conversation'}
    ${speakerChange ? 'Speaker changes after this line.' : 'Same speaker continues.'}

    Consider:
    1. Emotional tone and intensity
    2. Type of utterance (question, statement, exclamation)
    3. Topic continuity and relevance
    4. Turn-taking dynamics
    5. Prosody markers (emphasis, intonation)
    6. Social dynamics (formality, agreement, dominance)

    Provide a structured analysis focusing on natural timing and flow.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Parse Claude's response into structured analysis
    const responseContent = response.content[0].type === 'text' ? 
      (response.content[0] as { type: 'text', text: string }).text : '';
    const analysis = this.parseClaudeResponse(responseContent);
    return analysis;
  }

  private parseClaudeResponse(response: string): DialogueContext {
    // Initialize default context
    const context: DialogueContext = {
      emotionalTone: 'neutral',
      intentType: 'statement',
      topicContinuity: 0.5,
      turnTakingDynamics: {
        isInterruption: false,
        isDelayedResponse: false,
        isDirectResponse: true,
        responseUrgency: 0.5
      },
      prosodyMarkers: {
        emphasis: 0.5,
        intonation: 'flat',
        tempo: 'medium'
      },
      socialDynamics: {
        formality: 0.5,
        agreement: 0,
        dominance: 0
      }
    };

    try {
      // Extract emotional tone
      const emotionalMatch = response.match(/emotional tone:?\s*([a-zA-Z]+)/i);
      if (emotionalMatch) context.emotionalTone = emotionalMatch[1].toLowerCase();

      // Extract intent type
      const intentMatch = response.match(/type:?\s*([a-zA-Z]+)/i);
      if (intentMatch) context.intentType = intentMatch[1].toLowerCase();

      // Extract topic continuity
      const continuityMatch = response.match(/topic continuity:?\s*(0\.\d+|1\.0)/i);
      if (continuityMatch) context.topicContinuity = parseFloat(continuityMatch[1]);

      // Extract turn-taking dynamics
      const interruptionMatch = response.match(/interruption:?\s*(true|false)/i);
      if (interruptionMatch) context.turnTakingDynamics.isInterruption = interruptionMatch[1].toLowerCase() === 'true';

      // Extract prosody markers
      const emphasisMatch = response.match(/emphasis:?\s*(0\.\d+|1\.0)/i);
      if (emphasisMatch) context.prosodyMarkers.emphasis = parseFloat(emphasisMatch[1]);

      const intonationMatch = response.match(/intonation:?\s*(rising|falling|flat)/i);
      if (intonationMatch) context.prosodyMarkers.intonation = intonationMatch[1].toLowerCase();

      // Extract social dynamics
      const formalityMatch = response.match(/formality:?\s*(0\.\d+|1\.0)/i);
      if (formalityMatch) context.socialDynamics.formality = parseFloat(formalityMatch[1]);

      const agreementMatch = response.match(/agreement:?\s*(-?\d+\.\d+)/i);
      if (agreementMatch) context.socialDynamics.agreement = parseFloat(agreementMatch[1]);
    } catch (error) {
      console.warn('Error parsing Claude response:', error);
    }

    return context;
  }

  private calculatePauseDuration(context: DialogueContext, speakerChange: boolean): number {
    let pause = 0.8; // Base pause

    // Adjust for turn-taking dynamics
    if (speakerChange) {
      pause += 0.5;
      if (context.turnTakingDynamics.isDelayedResponse) pause += 0.3;
      if (context.turnTakingDynamics.responseUrgency > 0.7) pause -= 0.2;
    }

    // Adjust for emotional tone
    if (context.emotionalTone === 'excited') pause -= 0.2;
    if (context.emotionalTone === 'contemplative') pause += 0.3;

    // Adjust for intent type
    if (context.intentType === 'question') pause += 0.3;
    if (context.intentType === 'exclamation') pause += 0.2;

    // Adjust for topic continuity
    pause += (1 - context.topicContinuity) * 0.5;

    // Adjust for prosody
    if (context.prosodyMarkers.emphasis > 0.7) pause += 0.2;
    if (context.prosodyMarkers.tempo === 'slow') pause += 0.2;
    if (context.prosodyMarkers.tempo === 'fast') pause -= 0.2;

    // Add slight randomization (±10%)
    const randomFactor = 1 + (Math.random() * 0.2 - 0.1);
    pause *= randomFactor;

    // Ensure minimum and maximum bounds
    return Math.max(0.3, Math.min(pause, 2.5));
  }

  async analyzeLine(
    currentLine: string,
    previousLine: string | null = null,
    nextLine: string | null = null,
    speakerChange: boolean = false
  ): Promise<AnalysisResult> {
    // Generate cache key
    const cacheKey = JSON.stringify({ currentLine, previousLine, nextLine, speakerChange });
    
    // Check cache first
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    // Perform new analysis
    const context = await this.analyzeWithClaude(currentLine, previousLine, nextLine, speakerChange);
    const suggestedPause = this.calculatePauseDuration(context, speakerChange);
    
    const result: AnalysisResult = {
      context,
      suggestedPause,
      confidenceScore: 0.85 // Base confidence score
    };

    // Adjust confidence based on context completeness
    if (!previousLine) result.confidenceScore *= 0.9;
    if (!nextLine) result.confidenceScore *= 0.9;
    if (context.emotionalTone === 'neutral') result.confidenceScore *= 0.95;

    // Cache the result
    this.analysisCache.set(cacheKey, result);

    return result;
  }

  clearCache(): void {
    this.analysisCache.clear();
  }
}
