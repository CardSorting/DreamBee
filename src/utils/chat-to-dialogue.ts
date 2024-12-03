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
    voiceId: PREDEFINED_VOICES.MALE_1.voiceId,
    settings: PREDEFINED_VOICES.MALE_1.settings
  }

  const assistantCharacter: CharacterVoice = {
    customName: 'Sarah',
    voiceId: PREDEFINED_VOICES.FEMALE_1.voiceId,
    settings: PREDEFINED_VOICES.FEMALE_1.settings
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
