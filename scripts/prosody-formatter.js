class ProsodyFormatter {
  constructor() {
    this.volumeLevels = {
      normal: '0dB',
      emphasis: '+2dB',
      deemphasis: '-2dB',
      whisper: '-6dB'
    };

    this.pitchLevels = {
      normal: 'medium',
      high: 'high',
      low: 'low',
      question: 'high',
      statement: 'medium',
      exclamation: 'x-high'
    };

    this.rateLevels = {
      normal: '1.0',
      fast: '1.2',
      slow: '0.8',
      very_slow: '0.6'
    };
  }

  determineSettings(context) {
    const settings = {
      volume: this.volumeLevels.normal,
      pitch: this.pitchLevels.normal,
      rate: this.rateLevels.normal
    };

    // Adjust for emotional tone
    if (context.emotionalTone) {
      settings.volume = this.getVolumeForEmotion(context.emotionalTone);
      settings.pitch = this.getPitchForEmotion(context.emotionalTone);
      settings.rate = this.getRateForEmotion(context.emotionalTone);
    }

    // Adjust for emphasis
    if (context.prosodyMarkers && context.prosodyMarkers.emphasis > 0.7) {
      settings.volume = this.volumeLevels.emphasis;
    }

    // Adjust for intent type
    if (context.intentType) {
      settings.pitch = this.getPitchForIntent(context.intentType);
    }

    return settings;
  }

  getVolumeForEmotion(emotion) {
    switch (emotion) {
      case 'excited':
      case 'angry':
        return this.volumeLevels.emphasis;
      case 'sad':
      case 'contemplative':
        return this.volumeLevels.deemphasis;
      default:
        return this.volumeLevels.normal;
    }
  }

  getPitchForEmotion(emotion) {
    switch (emotion) {
      case 'excited':
      case 'angry':
        return this.pitchLevels.high;
      case 'sad':
      case 'contemplative':
        return this.pitchLevels.low;
      default:
        return this.pitchLevels.normal;
    }
  }

  getRateForEmotion(emotion) {
    switch (emotion) {
      case 'excited':
        return this.rateLevels.fast;
      case 'contemplative':
      case 'sad':
        return this.rateLevels.slow;
      default:
        return this.rateLevels.normal;
    }
  }

  getPitchForIntent(intent) {
    switch (intent) {
      case 'question':
        return this.pitchLevels.question;
      case 'exclamation':
        return this.pitchLevels.exclamation;
      default:
        return this.pitchLevels.statement;
    }
  }
}

module.exports = {
  ProsodyFormatter
};
