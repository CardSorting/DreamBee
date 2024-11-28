const axios = require('axios');
const { SpeechFormatter } = require('./speech-formatter');

class ElevenLabsService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.speechFormatter = new SpeechFormatter();
  }

  async generateSpeech(text, character, startTime = 0, analysisResult = null) {
    try {
      // Format text with emotional and prosody markers if analysis is provided
      let formattedSpeech;
      if (analysisResult) {
        formattedSpeech = this.speechFormatter.formatSpeech(text, analysisResult);
        console.log('Original text:', formattedSpeech.narration);
        console.log('TTS text with SSML:', formattedSpeech.tts);
      } else {
        formattedSpeech = {
          narration: text,
          tts: text,
          transcript: text
        };
      }

      // Log voice ID being used
      console.log('Using voice ID:', character.voiceId);

      // Generate speech using TTS-formatted text
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/text-to-speech/${character.voiceId}`,
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        data: {
          text: formattedSpeech.tts,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: character.settings?.stability || 0.5,
            similarity_boost: character.settings?.similarity_boost || 0.75,
            style: 1.0,
            use_speaker_boost: true
          }
        },
        responseType: 'arraybuffer'
      });

      // Log generation details
      const audioSize = response.data.length;
      const durationInSeconds = (audioSize * 8) / (128 * 1024);

      console.log('Speech generated successfully:');
      console.log(`- Character: ${character.name}`);
      console.log(`- Voice ID: ${character.voiceId}`);
      console.log(`- Audio size: ${audioSize} bytes`);
      console.log(`- Duration: ${durationInSeconds}s`);
      console.log(`- Start time: ${startTime}s`);
      console.log(`- End time: ${startTime + durationInSeconds}s`);

      // Return audio data with timing information
      return {
        character,
        audio: response.data,
        startTime,
        endTime: startTime + durationInSeconds,
        timestamps: {
          characters: formattedSpeech.narration.split(''),
          character_start_times_seconds: Array.from({ length: formattedSpeech.narration.length }, 
            (_, i) => startTime + (i * durationInSeconds / formattedSpeech.narration.length)
          ),
          character_end_times_seconds: Array.from({ length: formattedSpeech.narration.length }, 
            (_, i) => startTime + ((i + 1) * durationInSeconds / formattedSpeech.narration.length)
          )
        },
        // Include clean text for transcript
        text: formattedSpeech.transcript
      };
    } catch (error) {
      console.error('Error generating speech:', error.message);
      if (error.response) {
        const responseData = error.response.data instanceof Buffer 
          ? JSON.parse(error.response.data.toString())
          : error.response.data;
        console.error('Response data:', JSON.stringify(responseData, null, 2));
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  async getVoices() {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/voices`,
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting voices:', error.message);
      throw error;
    }
  }

  async getVoice(voiceId) {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/voices/${voiceId}`,
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting voice:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const elevenLabs = new ElevenLabsService(process.env.ELEVENLABS_API_KEY);

module.exports = {
  elevenLabs
};
