function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${
    minutes.toString().padStart(2, '0')}:${
    secs.toString().padStart(2, '0')},${
    ms.toString().padStart(3, '0')}`;
}

function formatVTTTimestamp(seconds) {
  return formatTimestamp(seconds).replace(',', '.');
}

function generateSRT(segments) {
  let srtContent = '';
  let subtitleIndex = 1;

  segments.forEach(segment => {
    const text = segment.timestamps.characters.join('');
    const words = text.trim().split(/\s+/);
    let wordStartIndex = 0;

    words.forEach(word => {
      // Find the word in the original text, considering potential whitespace
      const wordStartInText = text.indexOf(word, wordStartIndex);
      const wordEndInText = wordStartInText + word.length;
      
      const startTime = segment.timestamps.character_start_times_seconds[wordStartInText];
      const endTime = segment.timestamps.character_end_times_seconds[wordEndInText - 1];
      
      srtContent += `${subtitleIndex}\n`;
      srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(endTime)}\n`;
      srtContent += `${segment.character.name}: ${word}\n\n`;
      
      subtitleIndex++;
      wordStartIndex = wordEndInText;
    });
  });

  return srtContent;
}

function generateVTT(segments) {
  let vttContent = 'WEBVTT\n\n';

  segments.forEach(segment => {
    const text = segment.timestamps.characters.join('');
    const words = text.trim().split(/\s+/);
    let wordStartIndex = 0;

    words.forEach(word => {
      // Find the word in the original text, considering potential whitespace
      const wordStartInText = text.indexOf(word, wordStartIndex);
      const wordEndInText = wordStartInText + word.length;
      
      const startTime = segment.timestamps.character_start_times_seconds[wordStartInText];
      const endTime = segment.timestamps.character_end_times_seconds[wordEndInText - 1];
      
      vttContent += `${formatVTTTimestamp(startTime)} --> ${formatVTTTimestamp(endTime)}\n`;
      vttContent += `${segment.character.name}: ${word}\n\n`;
      
      wordStartIndex = wordEndInText;
    });
  });

  return vttContent;
}

// Generate a transcript with timing information
function generateTranscript(segments) {
  const transcript = segments.map(segment => {
    const text = segment.timestamps.characters.join('');
    const words = text.trim().split(/\s+/);
    let wordStartIndex = 0;
    
    const wordTimings = words.map(word => {
      const wordStartInText = text.indexOf(word, wordStartIndex);
      const wordEndInText = wordStartInText + word.length;
      
      const timing = {
        word,
        speaker: segment.character.name,
        start: segment.timestamps.character_start_times_seconds[wordStartInText],
        end: segment.timestamps.character_end_times_seconds[wordEndInText - 1]
      };
      
      wordStartIndex = wordEndInText;
      return timing;
    });

    return {
      speaker: segment.character.name,
      text: text.trim(),
      words: wordTimings,
      start: segment.startTime,
      end: segment.endTime
    };
  });

  return {
    segments: transcript,
    duration: Math.max(...segments.map(s => s.endTime)),
    speakers: [...new Set(segments.map(s => s.character.name))]
  };
}

module.exports = {
  generateSRT,
  generateVTT,
  generateTranscript
};
