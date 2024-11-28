import fetch from 'node-fetch'

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('Missing ElevenLabs API key')
}

const API_KEY = process.env.ELEVENLABS_API_KEY
const BASE_URL = 'https://api.elevenlabs.io/v1'

export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style?: number
  use_speaker_boost?: boolean
}

export interface Character {
  voiceId: string
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
  audio: ArrayBuffer
  timestamps: TimestampData
  startTime: number  // Start time in the overall conversation
  endTime: number    // End time in the overall conversation
}

const defaultVoiceSettings: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75
}

interface TextToSpeechResponse {
  audio_base64: string
  alignment: TimestampData
}

class ElevenLabsService {
  private apiKey: string

  constructor() {
    this.apiKey = API_KEY
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

      const url = `${BASE_URL}/text-to-speech/${character.voiceId}/with-timestamps`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: character.settings || defaultVoiceSettings,
          output_format: 'mp3_44100_128'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as TextToSpeechResponse
      
      // Convert base64 to ArrayBuffer
      const binaryString = atob(data.audio_base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Calculate end time based on the last timestamp
      const endTime = startTime + Math.max(...data.alignment.character_end_times_seconds)

      // Adjust timestamps to account for the start time in the conversation
      const adjustedTimestamps: TimestampData = {
        characters: data.alignment.characters,
        character_start_times_seconds: data.alignment.character_start_times_seconds.map(t => t + startTime),
        character_end_times_seconds: data.alignment.character_end_times_seconds.map(t => t + startTime)
      }

      console.log(`Speech generated successfully:`)
      console.log(`- Character: ${character.name}`)
      console.log(`- Audio size: ${bytes.length} bytes`)
      console.log(`- Duration: ${endTime - startTime}s`)
      console.log(`- Start time: ${startTime}s`)
      console.log(`- End time: ${endTime}s`)

      return {
        character,
        audio: bytes.buffer,
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

      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('ElevenLabs quota exceeded. Please try again later.')
        }
        if (error.message.includes('authorization')) {
          throw new Error('Invalid ElevenLabs API key. Please check your configuration.')
        }
        if (error.message.includes('voice not found')) {
          throw new Error(`Voice ID ${character.voiceId} not found. Please verify the voice exists.`)
        }
      }

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

  // Helper method to validate voice ID
  async validateVoice(voiceId: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      })
      return response.ok
    } catch (error) {
      return false
    }
  }
}

export const elevenLabs = new ElevenLabsService()
