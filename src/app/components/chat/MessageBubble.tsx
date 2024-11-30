'use client'

import { chatStyles } from '../../../utils/styles'
import TimeStamp from './TimeStamp'

interface MessageBubbleProps {
  content: string
  timestamp: string
  isAssistant: boolean
  userInitials: string
}

export const MessageBubble = ({ content, timestamp, isAssistant, userInitials }: MessageBubbleProps) => {
  return (
    <div className={`${chatStyles.message.container(isAssistant)} group relative`}>
      <div className={chatStyles.message.wrapper(isAssistant)}>
        <div className={chatStyles.message.avatar(isAssistant)}>
          {isAssistant ? 'A' : userInitials}
        </div>
        <div className="relative">
          <div className={chatStyles.message.bubble(isAssistant)}>
            {content}
          </div>
          <TimeStamp timestamp={timestamp} isAssistant={isAssistant} />
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
