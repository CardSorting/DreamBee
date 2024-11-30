export * from './client'
export * from './types'
export * from './manual-dialogues'

// Table names from environment variables
export const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'
export const CONVERSATIONS_TABLE = process.env.DYNAMODB_CONVERSATIONS_TABLE || 'conversations'
export const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_MANUAL_DIALOGUES_TABLE || 'manual-dialogues'
