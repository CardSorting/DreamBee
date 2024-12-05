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
const MIN_CHARACTERS_PER_TURN = 1 // Minimum characters per turn
const MAX_CHARACTERS_PER_TURN = 1000 // Maximum characters per turn

export function validateTurn(turn: DialogueTurn): { isValid: boolean; reason?: string } {
  if (!turn.character || typeof turn.character !== 'string') {
    return { isValid: false, reason: 'Character name is required and must be a string' }
  }

  if (!turn.text || typeof turn.text !== 'string') {
    return { isValid: false, reason: 'Text is required and must be a string' }
  }

  if (turn.text.length < MIN_CHARACTERS_PER_TURN) {
    return { isValid: false, reason: `Text must be at least ${MIN_CHARACTERS_PER_TURN} character long` }
  }

  if (turn.text.length > MAX_CHARACTERS_PER_TURN) {
    return { isValid: false, reason: `Text cannot exceed ${MAX_CHARACTERS_PER_TURN} characters` }
  }

  return { isValid: true }
}

export function validateDialogue(dialogue: DialogueTurn[]): { isValid: boolean; reason?: string } {
  if (!Array.isArray(dialogue)) {
    return { isValid: false, reason: 'Dialogue must be an array' }
  }

  if (dialogue.length === 0) {
    return { isValid: false, reason: 'Dialogue must contain at least one turn' }
  }

  for (let i = 0; i < dialogue.length; i++) {
    const validation = validateTurn(dialogue[i])
    if (!validation.isValid) {
      return { isValid: false, reason: `Turn ${i + 1}: ${validation.reason}` }
    }
  }

  return { isValid: true }
}

export function chunkDialogue(
  title: string,
  description: string,
  characters: CharacterVoice[],
  dialogue: DialogueTurn[]
): DialogueChunk[] {
  // Validate inputs
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required and must be a string')
  }

  if (typeof description !== 'string') {
    throw new Error('Description must be a string')
  }

  if (!Array.isArray(characters) || characters.length === 0) {
    throw new Error('At least one character configuration is required')
  }

  const dialogueValidation = validateDialogue(dialogue)
  if (!dialogueValidation.isValid) {
    throw new Error(dialogueValidation.reason)
  }

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
  // First validate the dialogue structure
  const dialogueValidation = validateDialogue(dialogue)
  if (!dialogueValidation.isValid) {
    return dialogueValidation
  }

  const totalTurns = dialogue.length
  const totalCharacters = dialogue.reduce((sum, turn) => sum + turn.text.length, 0)

  const recommendedChunks = Math.max(
    Math.ceil(totalTurns / MAX_TURNS_PER_CHUNK),
    Math.ceil(totalCharacters / MAX_CHARACTERS_PER_CHUNK)
  )

  if (recommendedChunks > 10) {
    return {
      isValid: false,
      reason: `Dialogue is too long. Maximum allowed chunks is 10, but this dialogue requires ${recommendedChunks} chunks.`,
      recommendedChunks
    }
  }

  if (recommendedChunks > 1) {
    return {
      isValid: true,
      reason: `Dialogue will be split into ${recommendedChunks} chunks for processing`,
      recommendedChunks
    }
  }

  return {
    isValid: true,
    recommendedChunks: 1
  }
}

export function estimateProcessingTime(dialogue: DialogueTurn[]): {
  totalMinutes: number
  chunksRequired: number
} {
  // Validate dialogue first
  const validation = validateDialogue(dialogue)
  if (!validation.isValid) {
    throw new Error(validation.reason)
  }

  const { recommendedChunks } = validateDialogueLength(dialogue)

  // Base processing time per chunk
  const baseTimePerChunk = 2 // minutes
  
  // Additional time per turn for audio generation and transcription
  const timePerTurn = 0.5 // minutes
  
  const totalTurns = dialogue.length
  const totalMinutes = (baseTimePerChunk * recommendedChunks!) + (timePerTurn * totalTurns)

  return {
    totalMinutes: Math.ceil(totalMinutes),
    chunksRequired: recommendedChunks!
  }
}
