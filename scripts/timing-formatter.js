class TimingFormatter {
  constructor() {
    this.MAX_BREAKS = 5;
    
    this.pauseDurations = {
      short: 0.2,
      medium: 0.5,
      long: 1.0,
      veryLong: 1.5
    };

    this.breakPatterns = {
      comma: this.pauseDurations.short,
      period: this.pauseDurations.medium,
      exclamation: this.pauseDurations.medium,
      question: this.pauseDurations.medium,
      ellipsis: this.pauseDurations.long
    };
  }

  formatTiming(text, timing, context) {
    let breakCount = 0;
    let formattedText = text;

    // Add pre-pause if significant
    if (timing.prePause >= 0.3 && breakCount < this.MAX_BREAKS) {
      const duration = this.calculatePrePause(timing.prePause, context);
      formattedText = `<break time="${duration}s"/>${formattedText}`;
      breakCount++;
    }

    // Add natural breaks at punctuation
    formattedText = this.addPunctuationBreaks(formattedText, breakCount);

    // Add post-pause if significant
    if (timing.postPause >= 0.3 && breakCount < this.MAX_BREAKS) {
      const duration = this.calculatePostPause(timing.postPause, context);
      formattedText = `${formattedText}<break time="${duration}s"/>`;
    }

    return formattedText;
  }

  calculatePrePause(basePause, context) {
    let pause = basePause;

    // Adjust for turn-taking dynamics
    if (context.turnTakingDynamics) {
      if (context.turnTakingDynamics.isDelayedResponse) {
        pause = Math.max(pause, this.pauseDurations.long);
      }
      if (context.turnTakingDynamics.isInterruption) {
        pause = Math.min(pause, this.pauseDurations.short);
      }
    }

    // Adjust for emotional context
    if (context.emotionalTone === 'contemplative') {
      pause = Math.max(pause, this.pauseDurations.long);
    }

    return Math.min(pause, this.pauseDurations.veryLong);
  }

  calculatePostPause(basePause, context) {
    let pause = basePause;

    // Adjust for intent type
    if (context.intentType === 'question') {
      pause = Math.max(pause, this.pauseDurations.medium);
    }

    // Adjust for emphasis
    if (context.prosodyMarkers && context.prosodyMarkers.emphasis > 0.7) {
      pause = Math.max(pause, this.pauseDurations.medium);
    }

    return Math.min(pause, this.pauseDurations.veryLong);
  }

  addPunctuationBreaks(text, breakCount) {
    if (breakCount >= this.MAX_BREAKS) return text;

    return text.replace(/([,.!?…]+)(\s|$)/g, (match, punctuation, space) => {
      if (breakCount >= this.MAX_BREAKS) return match;

      let duration = this.breakPatterns.comma; // default
      
      if (punctuation.includes('.')) duration = this.breakPatterns.period;
      if (punctuation.includes('!')) duration = this.breakPatterns.exclamation;
      if (punctuation.includes('?')) duration = this.breakPatterns.question;
      if (punctuation.includes('…')) duration = this.breakPatterns.ellipsis;

      breakCount++;
      return `${punctuation}<break time="${duration}s"/>${space}`;
    });
  }
}

module.exports = {
  TimingFormatter
};
