'use client'

import { useEffect, useState } from 'react'
import { chatStyles } from '../../../utils/styles'

interface ReadReceiptProps {
  readAt?: string
  isAssistant: boolean
}

export const ReadReceipt = ({ readAt, isAssistant }: ReadReceiptProps) => {
  const [showRead, setShowRead] = useState(!!readAt)

  useEffect(() => {
    if (!readAt && !isAssistant) {
      // Simulate delay before showing read receipt
      const timeout = setTimeout(() => {
        setShowRead(true)
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [readAt, isAssistant])

  if (isAssistant || !showRead) return null

  return (
    <div className={chatStyles.readReceipt.container}>
      <div className="text-xs text-gray-500 mr-1">Read</div>
      <svg 
        className={chatStyles.readReceipt.icon}
        width="12" 
        height="12" 
        viewBox="0 0 16 16" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M13.707 4.707a1 1 0 0 0-1.414-1.414L6.5 9.086 3.707 6.293a1 1 0 0 0-1.414 1.414l3.5 3.5a1 1 0 0 0 1.414 0l6.5-6.5z"
          fill="currentColor"
        />
      </svg>
    </div>
  )
}

export default ReadReceipt
