import React, { forwardRef, useRef, useCallback } from 'react'
import { TimeFormatter } from '../utils/TimeFormatter'

interface ProgressBarProps {
  progress: number;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ progress, duration, currentTime, onSeek }, forwardedRef) => {
    const [isHovering, setIsHovering] = React.useState(false)
    const [hoverTime, setHoverTime] = React.useState<number | null>(null)
    
    // Create a mutable ref that combines the forwarded ref
    const combinedRef = useCallback(
      (node: HTMLDivElement | null) => {
        // Update the forwarded ref
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef]
    )

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const element = e.currentTarget
      if (element) {
        const bounds = element.getBoundingClientRect()
        const x = e.clientX - bounds.left
        const width = bounds.width
        const percentage = x / width
        const timeMs = TimeFormatter.getTimeFromPercentage(percentage * 100, duration)
        setHoverTime(timeMs)
      }
    }, [duration])

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const element = e.currentTarget
      if (element) {
        const bounds = element.getBoundingClientRect()
        const x = e.clientX - bounds.left
        const width = bounds.width
        const percentage = x / width
        const timeMs = TimeFormatter.getTimeFromPercentage(percentage * 100, duration)
        onSeek(timeMs)
      }
    }, [duration, onSeek])

    return (
      <div 
        className="flex-1 relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onMouseMove={handleMouseMove}
      >
        <div 
          ref={combinedRef}
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
            className="absolute top-0 transform -translate-y-full bg-gray-900 text-white text-xs px-2 py-1 rounded"
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
