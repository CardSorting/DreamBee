import { CharacterVoice } from './voice-config'

interface DialogueTurn {
  character: string
  text: string
}

interface DialogueChunk {
  title: string
  description: string
  characters: CharacterVoice[]
  dialogue: DialogueTurn[]
  chunkIndex: number
  totalChunks: number
}

const MAX_TURNS_PER_CHUNK = 50 // Maximum number of dialogue turns per chunk
const MAX_CHARACTERS_PER_CHUNK = 10000 // Maximum total characters per chunk

export function chunkDialogue(
  title: string,
  description: string,
  characters: CharacterVoice[],
  dialogue: DialogueTurn[]
): DialogueChunk[] {
  const chunks: DialogueChunk[] = []
  let currentChunk: DialogueTurn[] = []
  let currentCharCount = 0

  for (let i = 0; i < dialogue.length; i++) {
    const turn = dialogue[i]
    const turnCharCount = turn.text.length

    // Check if adding this turn would exceed either limit
    if (
      currentChunk.length >= MAX_TURNS_PER_CHUNK ||
      (currentCharCount + turnCharCount > MAX_CHARACTERS_PER_CHUNK && currentChunk.length > 0)
    ) {
      // Save current chunk and start a new one
      chunks.push({
        title: `${title} (Part ${chunks.length + 1})`,
        description: `${description} - Part ${chunks.length + 1}`,
        characters,
        dialogue: currentChunk,
        chunkIndex: chunks.length,
        totalChunks: Math.ceil(dialogue.length / MAX_TURNS_PER_CHUNK)
      })

      currentChunk = []
      currentCharCount = 0
    }

    currentChunk.push(turn)
    currentCharCount += turnCharCount
  }

  // Add the last chunk if it has any turns
  if (currentChunk.length > 0) {
    chunks.push({
      title: chunks.length === 0 ? title : `${title} (Part ${chunks.length + 1})`,
      description: chunks.length === 0 ? description : `${description} - Part ${chunks.length + 1}`,
      characters,
      dialogue: currentChunk,
      chunkIndex: chunks.length,
      totalChunks: Math.ceil(dialogue.length / MAX_TURNS_PER_CHUNK)
    })
  }

  // Update total chunks count now that we know the final number
  return chunks.map(chunk => ({
    ...chunk,
    totalChunks: chunks.length
  }))
}

export function validateDialogueLength(dialogue: DialogueTurn[]): {
  isValid: boolean
  reason?: string
  recommendedChunks?: number
} {
  const totalTurns = dialogue.length
  const totalCharacters = dialogue.reduce((sum, turn) => sum + turn.text.length, 0)

  if (totalTurns === 0) {
    return {
      isValid: false,
      reason: 'Dialogue must contain at least one turn'
    }
  }

  const recommendedChunks = Math.max(
    Math.ceil(totalTurns / MAX_TURNS_PER_CHUNK),
    Math.ceil(totalCharacters / MAX_CHARACTERS_PER_CHUNK)
  )

  if (recommendedChunks > 1) {
    return {
      isValid: false,
      reason: `Dialogue is too long. It will be split into ${recommendedChunks} chunks.`,
      recommendedChunks
    }
  }

  return { isValid: true }
}

export function estimateProcessingTime(dialogue: DialogueTurn[]): {
  totalMinutes: number
  chunksRequired: number
} {
  const AVERAGE_PROCESSING_TIME_PER_TURN = 15 // seconds
  const totalTurns = dialogue.length
  const chunksRequired = Math.ceil(totalTurns / MAX_TURNS_PER_CHUNK)
  
  // Calculate total processing time in minutes
  const totalSeconds = totalTurns * AVERAGE_PROCESSING_TIME_PER_TURN
  const totalMinutes = Math.ceil(totalSeconds / 60)

  return {
    totalMinutes,
    chunksRequired
  }
}
