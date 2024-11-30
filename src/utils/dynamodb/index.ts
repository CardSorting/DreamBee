// Table names
export const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'
export const CONVERSATIONS_TABLE = process.env.DYNAMODB_CONVERSATIONS_TABLE || 'conversations'
export const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_MANUAL_DIALOGUES_TABLE || 'manual-dialogues'

// Index names
export const UPDATED_AT_INDEX = 'UpdatedAtIndex'
export const CONVERSATION_ID_INDEX = 'ConversationIdIndex'
export const TYPE_INDEX = 'TypeIndex'

// Key prefixes
export const USER_PREFIX = 'USER#'
export const CONVERSATION_PREFIX = 'CONV#'
export const MANUAL_DIALOGUE_PREFIX = 'MDLG#'

// Item types
export const ITEM_TYPES = {
  USER: 'USER',
  CONVERSATION: 'CONVERSATION',
  MANUAL_DIALOGUE: 'MANUAL_DIALOGUE'
} as const

// Status types
export const STATUS_TYPES = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
} as const

// Utility functions
export function createPK(userId: string): string {
  return `${USER_PREFIX}${userId}`
}

export function createConversationSK(conversationId: string): string {
  return `${CONVERSATION_PREFIX}${conversationId}`
}

export function createManualDialogueSK(dialogueId: string): string {
  return `${MANUAL_DIALOGUE_PREFIX}${dialogueId}`
}

export function extractIdFromSK(sk: string, prefix: string): string {
  return sk.replace(prefix, '')
}

// Type guards
export function isValidStatus(status: string): status is keyof typeof STATUS_TYPES {
  return Object.values(STATUS_TYPES).includes(status as any)
}

export function isValidItemType(type: string): type is keyof typeof ITEM_TYPES {
  return Object.values(ITEM_TYPES).includes(type as any)
}
