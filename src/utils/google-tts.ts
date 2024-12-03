import * as tts from '@google-cloud/text-to-speech'
import { protos } from '@google-cloud/text-to-speech'

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Missing Google Cloud credentials')
}

export interface VoiceSettings {
  pitch?: number
  speakingRate?: number
  volumeGainDb?: number
}

export interface Character {
  voiceId: string  // Format: "language-code-voice-name", e.g., "en-US-Standard-A"
  name: string
  settings?: VoiceSettings
}

export interface TimestampData {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export interface AudioSegment {
  character: Character
  audio: Buffer
  timestamps: TimestampData
  startTime: number
  endTime: number
}

const defaultVoiceSettings: VoiceSettings = {
  pitch: 0,
  speakingRate: 1.0,
  volumeGainDb: 0
}

// Estimate duration based on character count and speaking rate
function estimateDuration(text: string, speakingRate: number = 1.0): number {
  // Average speaking rate is about 150 words per minute
  // Assuming average word length of 5 characters
  const charactersPerSecond = (150 * 5) / 60 * speakingRate
  return text.length / charactersPerSecond
}

// Generate simple timestamps based on estimated duration
function generateSimpleTimestamps(text: string, duration: number): TimestampData {
  const characters = text.split('')
  const timePerChar = duration / characters.length
  
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * timePerChar),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * timePerChar)
  }
}

class GoogleTTSService {
  private client: tts.TextToSpeechClient

  constructor() {
    this.client = new tts.TextToSpeechClient()
  }

  private parseVoiceId(voiceId: string): { languageCode: string, name: string } {
    const [languageCode, ...nameParts] = voiceId.split('-')
    return {
      languageCode: `${languageCode}-${nameParts[0]}`,
      name: voiceId
    }
  }

  async generateSpeech(
    text: string,
    character: Character,
    startTime: number = 0
  ): Promise<AudioSegment> {
    try {
      console.log(`Generating speech for character: ${character.name}`)
      console.log(`Text length: ${text.length} characters`)
      console.log(`Start time in conversation: ${startTime}s`)

      const { languageCode, name } = this.parseVoiceId(character.voiceId)
      const settings = { ...defaultVoiceSettings, ...character.settings }

      const voice: protos.google.cloud.texttospeech.v1.IVoiceSelectionParams = {
        languageCode,
        name
      }

      const audioConfig: protos.google.cloud.texttospeech.v1.IAudioConfig = {
        audioEncoding: 'MP3' as const,
        pitch: settings.pitch,
        speakingRate: settings.speakingRate,
        volumeGainDb: settings.volumeGainDb
      }

      const [response] = await this.client.synthesizeSpeech({
        input: { text },
        voice,
        audioConfig
      })

      const audioContent = response.audioContent
      if (!audioContent) {
        throw new Error('No audio content generated')
      }

      const buffer = Buffer.from(audioContent)
      console.log(`Converted audio to buffer: ${buffer.length} bytes`)

      // Verify buffer is not empty
      if (buffer.length === 0) {
        throw new Error('Generated audio is empty')
      }

      // Estimate duration and generate timestamps
      const estimatedDuration = estimateDuration(text, settings.speakingRate)
      const timestamps = generateSimpleTimestamps(text, estimatedDuration)
      const endTime = startTime + estimatedDuration

      // Adjust timestamps to account for the start time in the conversation
      const adjustedTimestamps: TimestampData = {
        characters: timestamps.characters,
        character_start_times_seconds: timestamps.character_start_times_seconds.map(t => t + startTime),
        character_end_times_seconds: timestamps.character_end_times_seconds.map(t => t + startTime)
      }

      // Log detailed information about the generated audio
      console.log(`Speech generated successfully:`)
      console.log(`- Character: ${character.name}`)
      console.log(`- Audio size: ${buffer.length} bytes`)
      console.log(`- Estimated duration: ${estimatedDuration}s`)
      console.log(`- Start time: ${startTime}s`)
      console.log(`- End time: ${endTime}s`)

      return {
        character,
        audio: buffer,
        timestamps: adjustedTimestamps,
        startTime,
        endTime
      }
    } catch (error) {
      console.error('Error generating speech:', {
        character: character.name,
        textLength: text.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      throw error
    }
  }

  async generateConversation(
    dialogue: Array<{ character: Character; text: string }>
  ): Promise<AudioSegment[]> {
    console.log(`Starting conversation generation:`)
    console.log(`- Number of lines: ${dialogue.length}`)
    console.log(`- Characters: ${dialogue.map(d => d.character.name).join(', ')}`)

    const startTime = Date.now()
    const GAP_BETWEEN_LINES = 0.5 // 500ms gap between lines
    
    try {
      // Generate audio sequentially to maintain proper timing
      const audioSegments: AudioSegment[] = []
      let currentTime = 0

      for (let i = 0; i < dialogue.length; i++) {
        const { character, text } = dialogue[i]
        console.log(`\nGenerating line ${i + 1}/${dialogue.length} for ${character.name}`)
        console.log(`Starting at ${currentTime}s`)
        
        try {
          const segment = await this.generateSpeech(text, character, currentTime)
          audioSegments.push(segment)
          
          // Update current time for next segment, adding a gap
          currentTime = segment.endTime + GAP_BETWEEN_LINES
          console.log(`Line ${i + 1} generated successfully`)
          console.log(`Next line will start at ${currentTime}s`)
        } catch (error) {
          console.error(`Failed to generate line ${i + 1}:`, error)
          throw new Error(`Failed to generate audio for ${character.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      const duration = Date.now() - startTime
      console.log(`\nConversation generation completed:`)
      console.log(`- Total duration: ${duration}ms`)
      console.log(`- Average time per line: ${Math.round(duration / dialogue.length)}ms`)
      console.log(`- Total conversation length: ${currentTime}s`)
      
      return audioSegments
    } catch (error) {
      console.error('Error generating conversation:', error)
      throw new Error('Failed to generate conversation audio: ' + 
        (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Helper method to validate voice
  async validateVoice(voiceId: string): Promise<boolean> {
    try {
      const { languageCode } = this.parseVoiceId(voiceId)
      const [voices] = await this.client.listVoices({ languageCode })
      return voices.voices?.some(voice => voice.name === voiceId) || false
    } catch (error) {
      return false
    }
  }
}

export const googleTTS = new GoogleTTSService()
