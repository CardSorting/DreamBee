import React, { forwardRef } from 'react'
import { TimeFormatter } from '../utils/TimeFormatter'

interface ProgressBarProps {
  progress: number;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ progress, duration, currentTime, onSeek }, ref) => {
    const [isHovering, setIsHovering] = React.useState(false)
    const [hoverTime, setHoverTime] = React.useState<number | null>(null)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (ref.current) {
        const bounds = ref.current.getBoundingClientRect()
        const x = e.clientX - bounds.left
        const width = bounds.width
        const percentage = x / width
        const timeMs = TimeFormatter.getTimeFromPercentage(percentage * 100, duration)
        setHoverTime(timeMs)
      }
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (ref.current) {
        const bounds = ref.current.getBoundingClientRect()
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
          ref={ref}
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
)

ProgressBar.displayName = 'ProgressBar'
