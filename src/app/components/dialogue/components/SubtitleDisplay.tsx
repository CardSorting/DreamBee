import { useRef, memo } from 'react'
import { SubtitleDisplayProps } from '../utils/types'
import { SubtitleStyleManager } from '../utils/SubtitleStyleManager'

const SubtitleDisplay = ({ currentSubtitle, nextSubtitle }: SubtitleDisplayProps) => {
  const styleManager = useRef(new SubtitleStyleManager())

  // Debug logging
  console.log('SubtitleDisplay props:', { currentSubtitle, nextSubtitle })

  if (!currentSubtitle && !nextSubtitle) {
    return (
      <div className={styleManager.current.getContainerStyles()}>
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No subtitles available
        </div>
      </div>
    )
  }

  return (
    <div className={styleManager.current.getContainerStyles()}>
      <div className={styleManager.current.getWrapperStyles()}>
        {currentSubtitle && (
          <div className={styleManager.current.getSubtitleStyles('current')}>
            <div className={styleManager.current.getSpeakerStyles('current')}>
              {currentSubtitle.speaker || 'Speaker'}
            </div>
            <div 
              className={`${styleManager.current.getTextStyles('current')} mt-1`}
              style={{ 
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            >
              {currentSubtitle.text || ''}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.floor(currentSubtitle.start)}s - {Math.floor(currentSubtitle.end)}s
            </div>
          </div>
        )}
        {nextSubtitle && (
          <div
            className={styleManager.current.getSubtitleStyles('next')}
            aria-label="Next subtitle"
          >
            <div className={styleManager.current.getSpeakerStyles('next')}>
              {nextSubtitle.speaker || 'Speaker'}
            </div>
            <div 
              className={`${styleManager.current.getTextStyles('next')} mt-1`}
              style={{ 
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            >
              {nextSubtitle.text || ''}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.floor(nextSubtitle.start)}s - {Math.floor(nextSubtitle.end)}s
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Optimization: Prevent unnecessary re-renders
export default memo(SubtitleDisplay)
