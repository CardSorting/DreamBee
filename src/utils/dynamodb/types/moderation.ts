import { BaseItem } from '../types'

export const VALID_REPORT_REASONS = [
  'INAPPROPRIATE_CONTENT',
  'HATE_SPEECH',
  'HARASSMENT',
  'SPAM',
  'VIOLENCE',
  'COPYRIGHT',
  'OTHER'
] as const

export type ReportReason = typeof VALID_REPORT_REASONS[number]

export interface Report extends BaseItem {
  type: 'REPORT'
  reportId: string
  reporterId: string // User who made the report
  targetType: 'USER' | 'DIALOGUE' | 'COMMENT'
  targetId: string // userId, dialogueId, or commentId
  reason: ReportReason
  description?: string
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED'
  createdAt: string
  updatedAt: string
  moderatorNotes?: string
  moderatorId?: string // ID of moderator who handled the report
}

export interface Block extends BaseItem {
  type: 'BLOCK'
  blockerId: string // User who created the block
  blockedId: string // User who is blocked
  createdAt: string
  reason?: string
}

export interface BlockedDialogue extends BaseItem {
  type: 'BLOCKED_DIALOGUE'
  userId: string // User who blocked the dialogue
  dialogueId: string
  createdAt: string
  reason?: string
}
