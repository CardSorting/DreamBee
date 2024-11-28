class NarrationFormatter {
  constructor() {
    this.narrationPatterns = {
      // Patterns to identify and extract SSML tags
      breakTag: /<break\s+time="[\d.]+s"\s*\/>/g,
      prosodyTag: /<prosody[^>]*>.*?<\/prosody>/g,
      allTags: /<[^>]+>/g
    };
  }

  extractNarration(text) {
    // Remove all SSML tags to get clean narration text
    return text.replace(this.narrationPatterns.allTags, '');
  }

  extractSSMLTags(text) {
    // Extract all SSML tags in order
    const tags = [];
    let match;

    // Find all break tags
    const breakRegex = this.narrationPatterns.breakTag;
    while ((match = breakRegex.exec(text)) !== null) {
      tags.push({
        type: 'break',
        tag: match[0],
        index: match.index
      });
    }

    // Find all prosody tags
    const prosodyRegex = this.narrationPatterns.prosodyTag;
    while ((match = prosodyRegex.exec(text)) !== null) {
      tags.push({
        type: 'prosody',
        tag: match[0],
        index: match.index
      });
    }

    // Sort tags by their position in the text
    return tags.sort((a, b) => a.index - b.index);
  }

  combineTextAndTags(narrationText, ssmlTags) {
    // Insert SSML tags at appropriate positions in clean text
    let result = narrationText;
    let offset = 0;

    ssmlTags.forEach(tag => {
      // Calculate position based on original text structure
      const position = this.findTagPosition(narrationText, tag.index);
      if (position !== -1) {
        result = result.slice(0, position + offset) + tag.tag + result.slice(position + offset);
        offset += tag.tag.length;
      }
    });

    return result;
  }

  findTagPosition(text, originalIndex) {
    // Find appropriate position in clean text based on surrounding context
    const words = text.split(/\b/);
    let currentIndex = 0;
    
    for (let i = 0; i < words.length; i++) {
      if (currentIndex >= originalIndex) {
        // Found the position - insert before the current word
        return currentIndex;
      }
      currentIndex += words[i].length;
    }

    return text.length; // Append at end if no better position found
  }

  formatForTranscript(text) {
    // Remove SSML tags for transcript display
    return this.extractNarration(text).trim();
  }

  formatForTTS(text, ssmlTags) {
    // Combine clean text with SSML tags for TTS
    return this.combineTextAndTags(
      this.extractNarration(text),
      this.extractSSMLTags(text)
    );
  }
}

module.exports = {
  NarrationFormatter
};
