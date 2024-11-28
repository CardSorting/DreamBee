const { DialogueAnalyzer } = require('./dialogue-analyzer');
const { ProsodyAnalyzer } = require('./prosody-analyzer');

class ConversationFlowManager {
  constructor(anthropicApiKey) {
    this.dialogueAnalyzer = new DialogueAnalyzer(anthropicApiKey);
    this.prosodyAnalyzer = new ProsodyAnalyzer(anthropicApiKey);
    this.conversationState = {
      currentTopic: null,
      emotionalMomentum: 0,
      turnCount: 0,
      speakerHistory: []
    };
  }

  async analyzeTurn(currentLine, context = {}) {
    // Update conversation state
    this.conversationState.turnCount++;
    this.conversationState.speakerHistory.push(context.speaker);

    // Get both dialogue and prosody analysis
    const [dialogueAnalysis, prosodyAnalysis] = await Promise.all([
      this.dialogueAnalyzer.analyzeLine(
        currentLine,
        context.previousLine,
        context.nextLine,
        context.speakerChange
      ),
      this.prosodyAnalyzer.analyzeSpeechPattern(
        currentLine,
        {
          previousLine: context.previousLine,
          nextLine: context.nextLine,
          speakerChange: context.speakerChange
        }
      )
    ]);

    // Update emotional momentum
    this.updateEmotionalMomentum(dialogueAnalysis.context || {});

    // Combine analyses for natural timing
    return this.synthesizeAnalysis(dialogueAnalysis, prosodyAnalysis, context);
  }

  updateEmotionalMomentum(context) {
    // Emotional momentum affects timing and flow
    const emotionalIntensity = {
      'excited': 0.8,
      'angry': 0.7,
      'sad': -0.3,
      'contemplative': -0.2,
      'neutral': 0
    }[context.emotionalTone || 'neutral'] || 0;

    // Decay previous momentum and add new
    this.conversationState.emotionalMomentum *= 0.7; // Decay factor
    this.conversationState.emotionalMomentum += emotionalIntensity;
    // Clamp momentum between -1 and 1
    this.conversationState.emotionalMomentum = Math.max(-1, Math.min(1, this.conversationState.emotionalMomentum));
  }

  synthesizeAnalysis(dialogueAnalysis, prosodyAnalysis, context) {
    // Base timing from prosody analysis
    const timing = {
      prePause: (prosodyAnalysis.modifications || {}).prePause || 0.2,
      postPause: (prosodyAnalysis.modifications || {}).postPause || 0.2,
      pace: (prosodyAnalysis.characteristics || {}).pace || 1.0
    };

    // Adjust timing based on conversation state
    timing.prePause = this.adjustPrePause(timing.prePause, dialogueAnalysis, context);
    timing.postPause = this.adjustPostPause(timing.postPause, dialogueAnalysis, context);
    timing.pace = this.adjustPace(timing.pace, dialogueAnalysis, context);

    return {
      timing,
      context: {
        emotionalMomentum: this.conversationState.emotionalMomentum,
        turnCount: this.conversationState.turnCount,
        naturalness: (prosodyAnalysis.characteristics || {}).naturalness || 0.8,
        intonation: (prosodyAnalysis.modifications || {}).intonationCurve || { direction: 'flat' }
      },
      suggestions: this.generateSuggestions(dialogueAnalysis, prosodyAnalysis)
    };
  }

  adjustPrePause(basePause, dialogueAnalysis, context) {
    let pause = basePause;

    // Adjust for conversation momentum
    pause *= 1 - (Math.abs(this.conversationState.emotionalMomentum) * 0.3);

    // Adjust for turn count (conversations often start slower and become more fluid)
    if (this.conversationState.turnCount < 3) {
      pause *= 1.2;
    }

    // Adjust for topic shifts
    const topicContinuity = dialogueAnalysis.context?.topicContinuity ?? 0.5;
    if (topicContinuity < 0.5) {
      pause *= 1.3;
    }

    // Natural variation
    pause *= 0.9 + (Math.random() * 0.2);

    return Math.max(0.2, Math.min(pause, 1.5));
  }

  adjustPostPause(basePause, dialogueAnalysis, context) {
    let pause = basePause;

    // Shorter pauses during high emotional momentum
    if (Math.abs(this.conversationState.emotionalMomentum) > 0.7) {
      pause *= 0.8;
    }

    // Longer pauses for emphasis
    const emphasis = dialogueAnalysis.context?.prosodyMarkers?.emphasis ?? 0.5;
    if (emphasis > 0.8) {
      pause *= 1.2;
    }

    // Adjust for turn-taking dynamics
    const isDelayedResponse = dialogueAnalysis.context?.turnTakingDynamics?.isDelayedResponse ?? false;
    if (isDelayedResponse) {
      pause *= 1.3;
    }

    // Natural variation
    pause *= 0.9 + (Math.random() * 0.2);

    return Math.max(0.2, Math.min(pause, 1.5));
  }

  adjustPace(basePace, dialogueAnalysis, context) {
    let pace = basePace;

    // Adjust for emotional momentum
    pace *= 1 + (this.conversationState.emotionalMomentum * 0.2);

    // Adjust for turn position
    if (this.conversationState.turnCount < 2) {
      pace *= 0.9; // Slightly slower at start
    }

    // Adjust for content length
    const contentLength = (context.currentLine || '').length;
    if (contentLength > 100) {
      pace *= 1.1; // Slightly faster for longer content
    }

    return Math.max(0.8, Math.min(pace, 1.3));
  }

  generateSuggestions(dialogueAnalysis, prosodyAnalysis) {
    const context = dialogueAnalysis.context || {};
    const turnTakingDynamics = context.turnTakingDynamics || {};
    const prosodyMarkers = context.prosodyMarkers || {};
    
    return {
      // Natural flow suggestions
      flow: {
        type: turnTakingDynamics.isDirectResponse ? 'fluid' : 'measured',
        confidence: (prosodyAnalysis.characteristics || {}).naturalness || 0.8
      },
      
      // Emphasis suggestions
      emphasis: {
        points: prosodyMarkers.emphasis > 0.7 ? 'strong' : 'moderate',
        pattern: (prosodyAnalysis.modifications || {}).intonationCurve || { direction: 'flat' }
      },
      
      // Timing suggestions
      timing: {
        variation: this.conversationState.turnCount < 3 ? 'consistent' : 'natural',
        flexibility: Math.abs(this.conversationState.emotionalMomentum) > 0.5 ? 'dynamic' : 'stable'
      }
    };
  }

  reset() {
    this.conversationState = {
      currentTopic: null,
      emotionalMomentum: 0,
      turnCount: 0,
      speakerHistory: []
    };
  }
}

module.exports = {
  ConversationFlowManager
};
