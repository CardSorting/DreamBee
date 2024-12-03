import { useState, useRef } from 'react'
import { ProgressBarProps } from '../utils/types'
import { TimeFormatter } from '../utils/TimeFormatter'

export const ProgressBar = ({ progress, duration, currentTime, onSeek }: ProgressBarProps) => {
  const [isHovering, setIsHovering] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current) {
      const bounds = progressRef.current.getBoundingClientRect()
      const x = e.clientX - bounds.left
      const width = bounds.width
      const percentage = x / width
      const timeMs = TimeFormatter.getTimeFromPercentage(percentage * 100, duration)
      setHoverTime(timeMs)
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current) {
      const bounds = progressRef.current.getBoundingClientRect()
      const x = e.clientX - bounds.left
      const width = bounds.width
      const percentage = x / width
      const timeMs = TimeFormatter.getTimeFromPercentage(percentage * 100, duration)
      onSeek(timeMs)
    }
  }

  return (
    <div 
      className="flex-1 relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      <div 
        ref={progressRef}
        className="h-2 bg-gray-200 rounded-full cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      {isHovering && hoverTime !== null && (
        <div 
          className="absolute top-[-25px] bg-gray-800 text-white px-2 py-1 rounded text-xs transform -translate-x-1/2"
          style={{ left: `${(hoverTime / duration) * 100}%` }}
        >
          {TimeFormatter.formatTime(hoverTime)}
        </div>
      )}
    </div>
  )
}
