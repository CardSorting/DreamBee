class ConversationManager {
  constructor(speakers) {
    this.speakers = new Map();
    speakers.forEach(speaker => {
      this.speakers.set(speaker.name.toLowerCase(), speaker);
    });
    this.dialogue = [];
  }

  parseConversation(text) {
    // Clean up the text and split into lines
    const cleanText = text.trim().replace(/\r\n/g, '\n');
    
    // Enhanced regex to capture emotional and pacing tags
    // Format examples:
    // [adam|excited] Hello there!
    // [sarah|sad,slow] I'm not feeling well...
    // [adam|angry] What do you mean?! <break time="1.0s"/> That's ridiculous!
    const dialoguePattern = /\[(\w+)(?:\|([^\]]+))?\]\s*([^[]+)/g;
    const matches = cleanText.match(dialoguePattern);

    if (!matches) {
      throw new Error('No valid dialogue found in text');
    }

    const dialogue = [];
    
    for (const match of matches) {
      // Extract speaker, modifiers, and text
      const [_, speakerName, modifiers, text] = match.match(/\[(\w+)(?:\|([^\]]+))?\]\s*(.+)/) || [];
      if (!speakerName || !text) {
        continue;
      }

      const normalizedSpeakerName = speakerName.trim().toLowerCase();
      const speaker = this.speakers.get(normalizedSpeakerName);
      
      if (!speaker) {
        throw new Error(`Unknown speaker: ${speakerName}`);
      }

      // Parse modifiers into structured format
      const parsedModifiers = this.parseModifiers(modifiers);

      dialogue.push({
        speaker,
        text: text.trim(),
        index: dialogue.length,
        replyTo: dialogue.length > 0 ? dialogue.length - 1 : undefined,
        modifiers: parsedModifiers
      });
    }

    if (dialogue.length === 0) {
      throw new Error('No valid dialogue lines found');
    }

    this.dialogue = dialogue;
    return dialogue;
  }

  parseModifiers(modifiersString) {
    if (!modifiersString) {
      return {
        emotion: 'neutral',
        pace: 'normal',
        breaks: []
      };
    }

    const modifiers = modifiersString.split(',').map(m => m.trim().toLowerCase());
    
    // Extract emotional tone
    const emotions = ['excited', 'angry', 'sad', 'contemplative', 'neutral'];
    const emotion = modifiers.find(m => emotions.includes(m)) || 'neutral';

    // Extract pace
    const paces = ['slow', 'normal', 'fast'];
    const pace = modifiers.find(m => paces.includes(m)) || 'normal';

    // Extract break tags if present in the text
    const breaks = [];
    const breakPattern = /<break\s+time="([^"]+)"\s*\/>/g;
    let breakMatch;
    while ((breakMatch = breakPattern.exec(modifiersString)) !== null) {
      breaks.push(breakMatch[1]);
    }

    return {
      emotion,
      pace,
      breaks
    };
  }

  generateTranscript(segments) {
    const transcript = {
      metadata: {
        duration: Math.max(...segments.map(s => s.endTime)),
        speakers: Array.from(this.speakers.keys()),
        turnCount: segments.length,
        timing: {
          averageTurnDuration: 0,
          speakerChangePauses: [],
          emotionalTransitions: []
        }
      },
      turns: [],
      speakerTranscripts: {}
    };

    // Initialize speaker transcripts
    for (const speaker of this.speakers.keys()) {
      transcript.speakerTranscripts[speaker] = {
        lines: [],
        totalDuration: 0,
        wordCount: 0,
        timing: {
          averagePauseBefore: 0,
          averagePauseAfter: 0,
          turnTransitions: []
        }
      };
    }

    // Process each segment
    segments.forEach((segment, index) => {
      const text = segment.timestamps.characters.join('');
      const words = text.trim().split(/\s+/);
      const wordTimings = [];
      let wordStartIndex = 0;

      // Calculate word timings
      for (const word of words) {
        const wordStartInText = text.indexOf(word, wordStartIndex);
        const wordEndInText = wordStartInText + word.length;
        
        const startTime = segment.timestamps.character_start_times_seconds[wordStartInText];
        const endTime = segment.timestamps.character_end_times_seconds[wordEndInText - 1];
        
        wordTimings.push({
          word,
          startTime: startTime + segment.startTime,
          endTime: endTime + segment.startTime
        });
        
        wordStartIndex = wordEndInText;
      }

      // Calculate pause from previous turn
      const pauseFromPrevious = index > 0 ? 
        segment.startTime - segments[index - 1].endTime : 0;

      // Add to turns
      const turn = {
        index,
        speaker: segment.character.name.toLowerCase(),
        text: text.trim(),
        startTime: segment.startTime,
        endTime: segment.endTime,
        words: wordTimings,
        replyTo: index > 0 ? index - 1 : undefined,
        timing: {
          pauseFromPrevious,
          speakerChange: index > 0 && 
            segments[index - 1].character.name.toLowerCase() !== segment.character.name.toLowerCase(),
          pace: calculateSpeakingPace(wordTimings)
        }
      };
      transcript.turns.push(turn);

      // Update transcript metadata timing
      if (turn.timing.speakerChange) {
        transcript.metadata.timing.speakerChangePauses.push(pauseFromPrevious);
      }

      // Add to speaker transcript
      const speakerTranscript = transcript.speakerTranscripts[turn.speaker];
      speakerTranscript.lines.push({
        text: text.trim(),
        startTime: segment.startTime,
        endTime: segment.endTime,
        turnIndex: index,
        timing: turn.timing
      });
      speakerTranscript.totalDuration += segment.endTime - segment.startTime;
      speakerTranscript.wordCount += words.length;
      speakerTranscript.timing.turnTransitions.push({
        pauseBefore: pauseFromPrevious,
        duration: segment.endTime - segment.startTime,
        wordsPerMinute: calculateWordsPerMinute(words.length, segment.endTime - segment.startTime)
      });
    });

    // Calculate average timing metrics
    transcript.metadata.timing.averageTurnDuration = 
      transcript.turns.reduce((sum, turn) => sum + (turn.endTime - turn.startTime), 0) / transcript.turns.length;

    for (const speaker of Object.keys(transcript.speakerTranscripts)) {
      const transitions = transcript.speakerTranscripts[speaker].timing.turnTransitions;
      transcript.speakerTranscripts[speaker].timing.averagePauseBefore = 
        transitions.reduce((sum, t) => sum + t.pauseBefore, 0) / transitions.length;
      transcript.speakerTranscripts[speaker].timing.averageWordsPerMinute = 
        transitions.reduce((sum, t) => sum + t.wordsPerMinute, 0) / transitions.length;
    }

    return transcript;
  }

  generateSpeakerTimeline(transcript, speaker) {
    const speakerData = transcript.speakerTranscripts[speaker.toLowerCase()];
    if (!speakerData) {
      throw new Error(`No transcript data for speaker: ${speaker}`);
    }

    let timeline = `Timeline for ${speaker}:\n\n`;
    speakerData.lines.forEach((line, index) => {
      const turn = transcript.turns[line.turnIndex];
      const replyingTo = turn.replyTo !== undefined ? 
        transcript.turns[turn.replyTo].speaker : 'conversation start';

      timeline += `[${formatTime(line.startTime)} - ${formatTime(line.endTime)}]\n`;
      timeline += `Replying to: ${replyingTo}\n`;
      if (line.timing.speakerChange) {
        timeline += `Speaker Change Pause: ${line.timing.pauseFromPrevious.toFixed(2)}s\n`;
      }
      timeline += `Speaking Pace: ${line.timing.pace.toFixed(2)} words/min\n`;
      timeline += `Text: ${line.text}\n\n`;
    });

    timeline += `\nSpeaking Pattern Analysis:\n`;
    timeline += `Total speaking time: ${formatTime(speakerData.totalDuration)}\n`;
    timeline += `Word count: ${speakerData.wordCount}\n`;
    timeline += `Average words per turn: ${(speakerData.wordCount / speakerData.lines.length).toFixed(1)}\n`;
    timeline += `Average pause before speaking: ${speakerData.timing.averagePauseBefore.toFixed(2)}s\n`;
    timeline += `Average speaking pace: ${speakerData.timing.averageWordsPerMinute.toFixed(1)} words/min\n`;

    return timeline;
  }
}

function calculateSpeakingPace(wordTimings) {
  const duration = wordTimings[wordTimings.length - 1].endTime - wordTimings[0].startTime;
  return calculateWordsPerMinute(wordTimings.length, duration);
}

function calculateWordsPerMinute(wordCount, duration) {
  return (wordCount / duration) * 60;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(2);
  return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
}

function parseConversationText(text) {
  const cleanText = text.trim().replace(/\r\n/g, '\n');
  const matches = cleanText.match(/\[(\w+)(?:\|([^\]]+))?\]\s*([^[]+)/g) || [];
  
  return matches.map(match => {
    const [_, speaker, modifiers, text] = match.match(/\[(\w+)(?:\|([^\]]+))?\]\s*(.+)/) || [];
    return {
      speaker: speaker.trim(),
      text: text.trim(),
      modifiers: modifiers ? modifiers.split(',').map(m => m.trim()) : []
    };
  });
}

module.exports = {
  ConversationManager,
  parseConversationText,
  formatTime
};
