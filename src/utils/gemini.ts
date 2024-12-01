import { GoogleGenerativeAI } from "@google/generative-ai"

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash-8b",
  generationConfig: {
    maxOutputTokens: 2000,
    temperature: 0.7,
  }
})

interface Character {
  name: string
  voiceId: string
  description: string
}

interface DialogueLine {
  character: string
  text: string
}

interface GeneratedScript {
  title: string
  description: string
  characters: Character[]
  dialogue: DialogueLine[]
  genre: string
  estimatedDuration: number
}

export class GeminiService {
  private static instance: GeminiService
  private characters: Character[] = [
    {
      name: "Adam",
      voiceId: "pNInz6obpgDQGcFmaJgB",
      description: "Male, mid-30s, confident and articulate"
    },
    {
      name: "Sarah",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      description: "Female, late-20s, energetic and expressive"
    }
  ]

  private constructor() {}

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService()
    }
    return GeminiService.instance
  }

  async generateScript(genre: string, prompt?: string): Promise<GeneratedScript> {
    const systemPrompt = `You are a professional scriptwriter specializing in creating engaging dialogues. 
    Available characters:
    ${this.characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}
    
    Create a natural dialogue scene in the ${genre} genre. The dialogue should:
    1. Feel authentic and engaging
    2. Include appropriate emotional beats
    3. Demonstrate clear character dynamics
    4. Last approximately 2-3 minutes when spoken
    5. Include 6-10 dialogue turns
    
    Format the response as a JSON object with:
    - title: A catchy title for the scene
    - description: A brief description of the scene
    - characters: Array of character objects used
    - dialogue: Array of dialogue lines with character and text
    - genre: The specified genre
    - estimatedDuration: Estimated duration in seconds
    
    ${prompt ? `Additional context: ${prompt}` : ''}`

    try {
      const chat = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        }
      })

      const result = await chat.sendMessage([
        { text: systemPrompt },
        { text: 'Generate a dialogue scene.' }
      ])

      const response = result.response.text()

      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Failed to parse script from response')
      }

      const script = JSON.parse(jsonMatch[0]) as GeneratedScript

      // Map character names to full character objects with voice IDs
      script.characters = script.characters.map(char => {
        const fullChar = this.characters.find(c => c.name === char.name)
        if (!fullChar) {
          throw new Error(`Unknown character: ${char.name}`)
        }
        return fullChar
      })

      return script
    } catch (error) {
      console.error('Error generating script:', error)
      throw new Error('Failed to generate script')
    }
  }

  getAvailableCharacters(): Character[] {
    return this.characters
  }
}

export const geminiService = GeminiService.getInstance()
