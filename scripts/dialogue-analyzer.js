const Anthropic = require('@anthropic-ai/sdk');
const { redisService } = require('./redis-utils');

class DialogueAnalyzer {
  constructor(apiKey) {
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });
    this.analysisCache = new Map();
  }

  async analyzeLine(
    currentLine,
    previousLine = null,
    nextLine = null,
    speakerChange = false
  ) {
    // Generate cache key
    const cacheKey = JSON.stringify({ currentLine, previousLine, nextLine, speakerChange });
    
    // Check local cache first
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    // Get conversation history from Redis
    const recentConversations = await redisService.listConversations();
    let conversationHistory = '';
    
    if (recentConversations.length > 0) {
      const latestConversation = await redisService.getConversation(recentConversations[0]);
      if (latestConversation) {
        conversationHistory = this.formatConversationHistory(latestConversation);
      }
    }

    // Analyze with Claude
    const analysis = await this.analyzeWithClaude(
      currentLine, 
      previousLine, 
      nextLine, 
      speakerChange,
      conversationHistory
    );

    // Calculate timing and pauses
    const timing = this.calculateTiming(analysis, speakerChange);

    const result = {
      context: analysis.context,
      timing,
      emotionalCues: analysis.emotionalCues,
      confidenceScore: 0.85
    };

    // Adjust confidence based on context completeness
    if (!previousLine) result.confidenceScore *= 0.9;
    if (!nextLine) result.confidenceScore *= 0.9;
    if (analysis.context.emotionalTone === 'neutral') result.confidenceScore *= 0.95;

    // Cache the result
    this.analysisCache.set(cacheKey, result);

    return result;
  }

  formatConversationHistory(conversation) {
    if (!conversation.transcript || !conversation.transcript.json) {
      return '';
    }

    const { turns } = conversation.transcript.json;
    return turns.map(turn => 
      `[${turn.speaker}]: ${turn.text}`
    ).join('\n');
  }

  async analyzeWithClaude(
    currentLine,
    previousLine,
    nextLine,
    speakerChange,
    conversationHistory = ''
  ) {
    const prompt = `
    Analyze this dialogue for natural speech patterns and emotional expression.
    
    Previous context:
    ${conversationHistory ? conversationHistory + '\n' : 'No previous context available.'}

    Current segment:
    ${previousLine ? `Previous: "${previousLine}"` : 'Start of conversation'}
    Current: "${currentLine}"
    ${nextLine ? `Next: "${nextLine}"` : 'End of conversation'}
    ${speakerChange ? 'Speaker changes after this line.' : 'Same speaker continues.'}

    Provide a structured analysis with:

    1. Emotional Context:
    - Primary emotion (e.g., excited, angry, sad, contemplative)
    - How this emotion should be expressed (e.g., "he said excitedly", "she whispered sadly")
    - Natural vocal cues that would convey this emotion

    2. Pacing and Pauses:
    - Where natural breaks should occur
    - Length of pauses (in seconds)
    - Speaking tempo (fast, normal, slow)
    - Any hesitations or thoughtful pauses

    3. Conversational Flow:
    - How this line connects to previous/next lines
    - Turn-taking dynamics
    - Any interruptions or overlaps

    Format the analysis to help generate natural-sounding speech with appropriate emotional expression and timing.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return this.parseClaudeResponse(response.content[0].text);
  }

  parseClaudeResponse(response) {
    const analysis = {
      context: {
        emotionalTone: 'neutral',
        intentType: 'statement',
        topicContinuity: 0.5,
        turnTakingDynamics: {
          isInterruption: false,
          isDelayedResponse: false,
          isDirectResponse: true,
          responseUrgency: 0.5
        }
      },
      emotionalCues: {
        primaryEmotion: 'neutral',
        expressionStyle: '',
        vocalCues: []
      },
      timing: {
        naturalBreaks: [],
        tempo: 'normal',
        hesitations: []
      }
    };

    try {
      // Extract emotional context
      const emotionMatch = response.match(/primary emotion:?\s*([a-zA-Z]+)/i);
      if (emotionMatch) {
        analysis.emotionalCues.primaryEmotion = emotionMatch[1].toLowerCase();
        analysis.context.emotionalTone = emotionMatch[1].toLowerCase();
      }

      // Extract expression style
      const styleMatch = response.match(/should be expressed:?\s*"([^"]+)"/i);
      if (styleMatch) {
        analysis.emotionalCues.expressionStyle = styleMatch[1];
      }

      // Extract vocal cues
      const cuesSection = response.match(/vocal cues[^:]*:([^]*?)(?=\n\n|\n[A-Z]|$)/i);
      if (cuesSection) {
        analysis.emotionalCues.vocalCues = cuesSection[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
      }

      // Extract timing information
      const tempoMatch = response.match(/speaking tempo:?\s*([a-zA-Z]+)/i);
      if (tempoMatch) {
        analysis.timing.tempo = tempoMatch[1].toLowerCase();
      }

      // Extract natural breaks
      const breaksSection = response.match(/natural breaks[^:]*:([^]*?)(?=\n\n|\n[A-Z]|$)/i);
      if (breaksSection) {
        analysis.timing.naturalBreaks = breaksSection[1]
          .split('\n')
          .map(line => {
            const pauseMatch = line.match(/(\d+\.?\d*)\s*s/);
            return pauseMatch ? parseFloat(pauseMatch[1]) : null;
          })
          .filter(pause => pause !== null);
      }

      // Extract turn-taking dynamics
      const interruptionMatch = response.match(/interruption:?\s*(true|false)/i);
      if (interruptionMatch) {
        analysis.context.turnTakingDynamics.isInterruption = 
          interruptionMatch[1].toLowerCase() === 'true';
      }

      const delayMatch = response.match(/delayed response:?\s*(true|false)/i);
      if (delayMatch) {
        analysis.context.turnTakingDynamics.isDelayedResponse = 
          delayMatch[1].toLowerCase() === 'true';
      }
    } catch (error) {
      console.warn('Error parsing Claude response:', error);
    }

    return analysis;
  }

  calculateTiming(analysis, speakerChange) {
    const timing = {
      prePause: 0,
      postPause: 0,
      naturalBreaks: analysis.timing.naturalBreaks || [],
      tempo: analysis.timing.tempo || 'normal'
    };

    // Set base pauses
    if (speakerChange) {
      timing.prePause = 0.5;
      timing.postPause = 0.3;
    } else {
      timing.prePause = 0.2;
      timing.postPause = 0.2;
    }

    // Adjust for emotional context
    if (analysis.emotionalCues.primaryEmotion === 'excited') {
      timing.prePause *= 0.7;
      timing.postPause *= 0.7;
    } else if (analysis.emotionalCues.primaryEmotion === 'contemplative') {
      timing.prePause *= 1.5;
      timing.postPause *= 1.5;
    }

    // Adjust for turn-taking dynamics
    if (analysis.context.turnTakingDynamics.isDelayedResponse) {
      timing.prePause *= 2;
    }
    if (analysis.context.turnTakingDynamics.isInterruption) {
      timing.prePause *= 0.5;
    }

    return timing;
  }

  clearCache() {
    this.analysisCache.clear();
  }
}

module.exports = {
  DialogueAnalyzer
};
