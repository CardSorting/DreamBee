const { DialogueAnalyzer } = require('./dialogue-analyzer');

class ProsodyAnalyzer {
  constructor(anthropicApiKey) {
    this.dialogueAnalyzer = new DialogueAnalyzer(anthropicApiKey);
  }

  async analyzeSpeechPattern(text, context = {}) {
    const analysis = await this.dialogueAnalyzer.analyzeLine(
      text,
      context.previousLine,
      context.nextLine,
      context.speakerChange
    );

    // Extract prosody-specific insights from the analysis
    const prosody = {
      // Base timing from dialogue analysis
      baseTiming: analysis.timing || {},
      
      // Speech characteristics
      characteristics: {
        pace: this.derivePace(analysis),
        rhythm: this.deriveRhythm(analysis),
        naturalness: analysis.confidenceScore
      },

      // Suggested modifications
      modifications: {
        prePause: this.calculatePrePause(analysis),
        postPause: this.calculatePostPause(analysis),
        intonationCurve: this.deriveIntonation(analysis)
      }
    };

    return prosody;
  }

  derivePace(analysis) {
    // Default to normal pace
    const basePace = 1.0;

    // Adjust based on timing if available
    if (analysis.timing && analysis.timing.tempo) {
      return analysis.timing.tempo === 'fast' ? 1.2 :
             analysis.timing.tempo === 'slow' ? 0.8 : 
             basePace;
    }

    // Adjust for emotional context
    if (analysis.context && analysis.context.emotionalTone) {
      if (analysis.context.emotionalTone === 'excited') return basePace * 1.1;
      if (analysis.context.emotionalTone === 'contemplative') return basePace * 0.9;
    }

    return basePace;
  }

  deriveRhythm(analysis) {
    const context = analysis.context || {};
    const emphasis = (context.prosodyMarkers && context.prosodyMarkers.emphasis) || 0.5;
    
    return {
      // Natural variation in speech rhythm
      variation: emphasis,
      
      // Flow characteristics
      flow: (context.turnTakingDynamics && context.turnTakingDynamics.isDirectResponse) ? 
            'continuous' : 'measured',
      
      // Emphasis points based on context
      emphasis: emphasis > 0.7 ? 'strong' : 
               emphasis > 0.3 ? 'moderate' : 'light'
    };
  }

  calculatePrePause(analysis) {
    const context = analysis.context || {};
    // Calculate natural pause before speaking
    let prePause = 0.2; // Base pause

    // Add pause for thought processing
    if (context.turnTakingDynamics && context.turnTakingDynamics.isDelayedResponse) {
      prePause += 0.3;
    }

    // Add pause for emotional processing
    if (context.emotionalTone && 
        ['contemplative', 'surprised', 'uncertain'].includes(context.emotionalTone)) {
      prePause += 0.2;
    }

    // Add pause for topic transitions
    if (context.topicContinuity && context.topicContinuity < 0.5) {
      prePause += 0.3;
    }

    return Math.min(prePause, 1.0); // Cap at 1 second
  }

  calculatePostPause(analysis) {
    const context = analysis.context || {};
    // Calculate natural pause after speaking
    let postPause = 0.2; // Base pause

    // Add pause for turn-taking
    if (context.intentType === 'question') {
      postPause += 0.4;
    }

    // Add pause for emphasis
    if (context.prosodyMarkers && context.prosodyMarkers.emphasis > 0.7) {
      postPause += 0.2;
    }

    // Add pause for emotional impact
    if (context.emotionalTone && 
        ['emphatic', 'decisive'].includes(context.emotionalTone)) {
      postPause += 0.3;
    }

    return Math.min(postPause, 1.2); // Cap at 1.2 seconds
  }

  deriveIntonation(analysis) {
    const context = analysis.context || {};
    // Create natural intonation curve
    return {
      // Overall direction of pitch
      direction: (context.prosodyMarkers && context.prosodyMarkers.intonation) || 'flat',
      
      // Variation in pitch
      variation: (context.prosodyMarkers && context.prosodyMarkers.emphasis) || 0.5,
      
      // Natural ending
      ending: context.intentType === 'question' ? 'rising' :
              context.intentType === 'exclamation' ? 'sharp' : 'falling'
    };
  }

  async suggestTiming(text, context = {}) {
    const prosody = await this.analyzeSpeechPattern(text, context);
    
    return {
      prePause: prosody.modifications.prePause,
      postPause: prosody.modifications.postPause,
      pace: prosody.characteristics.pace,
      naturalness: prosody.characteristics.naturalness,
      intonation: prosody.modifications.intonationCurve
    };
  }
}

module.exports = {
  ProsodyAnalyzer
};
