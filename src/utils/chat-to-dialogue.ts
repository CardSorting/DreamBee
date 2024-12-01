import { ChatMessage } from '../app/types/chat'
import { PREDEFINED_VOICES, CharacterVoice } from './voice-config'

interface DialogueTurn {
  character: string
  text: string
}

interface ExportedDialogue {
  title: string
  description: string
  dialogue: DialogueTurn[]
  characters: CharacterVoice[]
}

export function convertChatToDialogue(messages: ChatMessage[]): ExportedDialogue {
  console.log('Converting messages:', messages)

  // Create default characters with proper voice IDs
  const userCharacter: CharacterVoice = {
    customName: 'Adam',
    voiceId: PREDEFINED_VOICES.male[0].id, // ErXwobaYiN019PkySvjV (Antoni)
    gender: 'male'
  }

  const assistantCharacter: CharacterVoice = {
    customName: 'Sarah',
    voiceId: PREDEFINED_VOICES.female[0].id, // EXAVITQu4vr4xnSDxMaL (Rachel)
    gender: 'female'
  }

  const characters = [userCharacter, assistantCharacter]
  console.log('Created characters:', characters)

  // Convert messages to dialogue turns, filtering out empty messages
  const dialogue = messages
    .filter(msg => msg.content.trim() !== '')
    .map(msg => ({
      character: msg.role === 'user' ? 'Adam' : 'Sarah',  // Match character names
      text: msg.content.trim()
    }))

  console.log('Created dialogue turns:', dialogue)

  // Generate title and description
  const title = 'Exported Chat Session'
  const description = `Conversation with ${messages.length} messages`

  const result: ExportedDialogue = {
    title,
    description,
    dialogue,
    characters
  }

  console.log('Final converted data:', result)
  return result
}
