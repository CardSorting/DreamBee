class SSMLUtils {
  static wrapWithBreak(duration) {
    return `<break time="${duration}s"/>`;
  }

  static wrapWithProsody(text, { volume, pitch, rate }) {
    const attributes = [];
    if (volume) attributes.push(`volume="${volume}"`);
    if (pitch) attributes.push(`pitch="${pitch}"`);
    if (rate) attributes.push(`rate="${rate}"`);
    
    return `<prosody ${attributes.join(' ')}>${text}</prosody>`;
  }

  static cleanupTags(text) {
    return text
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      // Clean up break tags
      .replace(/\s*<break/g, '<break')
      .replace(/\/>\s*/g, '/>')
      // Clean up prosody tags
      .replace(/\s*<prosody/g, '<prosody')
      .replace(/>\s*/g, '>')
      // Remove empty prosody tags
      .replace(/<prosody[^>]*><\/prosody>/g, '')
      // Clean up consecutive breaks
      .replace(/(<break[^>]*\/>)\s*(<break[^>]*\/>)/g, '$1')
      .trim();
  }

  static splitIntoSentences(text) {
    return text.split(/([.!?]+)/).filter(Boolean);
  }
}

module.exports = {
  SSMLUtils
};
