import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
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

export class AnthropicService {
  private static instance: AnthropicService
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

  static getInstance(): AnthropicService {
    if (!AnthropicService.instance) {
      AnthropicService.instance = new AnthropicService()
    }
    return AnthropicService.instance
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
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: 'Generate a dialogue scene.'
        }]
      })

      // Get the response content
      const content = response.content[0]
      if (!('type' in content) || content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API')
      }

      // Extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
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

export const anthropicService = AnthropicService.getInstance()
