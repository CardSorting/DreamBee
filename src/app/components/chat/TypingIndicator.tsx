'use client'

import { useEffect, useState } from 'react'
import { chatStyles } from '../../../utils/chat-styles'

interface TypingIndicatorProps {
  mode?: 'thinking' | 'typing'
}

export const TypingIndicator = ({ mode = 'typing' }: TypingIndicatorProps) => {
  const [dots, setDots] = useState('')

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return ''
        return prev + '.'
      })
    }, 400)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={chatStyles.typing.container}>
      <div className={chatStyles.typing.wrapper}>
        <div className={chatStyles.typing.avatar}>
          A
        </div>
        <div className={chatStyles.typing.bubble}>
          <div className="flex items-center gap-1">
            <span className={chatStyles.typing.text}>
              {mode === 'thinking' ? 'Assistant is thinking' : 'Assistant'}
            </span>
            <div className={chatStyles.typing.dots}>
              {dots}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TypingIndicator
