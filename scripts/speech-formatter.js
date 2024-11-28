const { SSMLUtils } = require('./ssml-utils');
const { ProsodyFormatter } = require('./prosody-formatter');
const { TimingFormatter } = require('./timing-formatter');
const { NarrationFormatter } = require('./narration-formatter');

class SpeechFormatter {
  constructor() {
    this.prosodyFormatter = new ProsodyFormatter();
    this.timingFormatter = new TimingFormatter();
    this.narrationFormatter = new NarrationFormatter();
  }

  formatSpeech(text, analysisResult) {
    // 1. Extract clean narration text
    const narrationText = this.narrationFormatter.extractNarration(text);

    // 2. Generate SSML formatting
    const formattedText = this.generateSSMLFormatting(narrationText, analysisResult);

    return {
      narration: narrationText,
      tts: formattedText,
      transcript: narrationText
    };
  }

  generateSSMLFormatting(text, analysisResult) {
    const context = analysisResult.context || {};
    const timing = analysisResult.timing || {};

    // 1. Get prosody settings
    const prosodySettings = this.prosodyFormatter.determineSettings(context);

    // 2. Apply base prosody settings
    let formattedText = SSMLUtils.wrapWithProsody(text, prosodySettings);

    // 3. Add timing markers
    formattedText = this.timingFormatter.formatTiming(formattedText, timing, context);

    // 4. Clean up tags
    return SSMLUtils.cleanupTags(formattedText);
  }
}

module.exports = {
  SpeechFormatter
};
