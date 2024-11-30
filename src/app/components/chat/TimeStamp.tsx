'use client'

interface TimeStampProps {
  timestamp: string
  isAssistant: boolean
}

export const TimeStamp = ({ timestamp, isAssistant }: TimeStampProps) => {
  return (
    <div className={`
      inline-flex items-center
      text-[10px] text-gray-400 
      whitespace-nowrap 
      select-none 
      font-medium 
      px-2
      py-0.5
      bg-white/50
      backdrop-blur-[2px]
      rounded-full
      z-10
      absolute
      ${isAssistant ? '-left-2' : '-right-2'}
      -top-6
      opacity-0
      transition-opacity
      duration-200
      group-hover:opacity-100
    `}>
      {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}

export default TimeStamp
