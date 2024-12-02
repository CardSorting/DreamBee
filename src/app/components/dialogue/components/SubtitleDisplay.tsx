import { useRef } from 'react'
import { SubtitleDisplayProps } from '../utils/types'
import { SubtitleStyleManager } from '../utils/SubtitleStyleManager'

export const SubtitleDisplay = ({ currentSubtitle, nextSubtitle }: SubtitleDisplayProps) => {
  const styleManager = useRef(new SubtitleStyleManager())

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
              {currentSubtitle.speaker}
            </div>
            <div 
              className={`${styleManager.current.getTextStyles('current')} mt-1`}
              style={{ 
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            >
              {currentSubtitle.text}
            </div>
          </div>
        )}
        {nextSubtitle && (
          <div
            className={styleManager.current.getSubtitleStyles('next')}
            aria-label="Next subtitle"
          >
            <div className={styleManager.current.getSpeakerStyles('next')}>
              {nextSubtitle.speaker}
            </div>
            <div 
              className={`${styleManager.current.getTextStyles('next')} mt-1`}
              style={{ 
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            >
              {nextSubtitle.text}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Optimization: Prevent unnecessary re-renders
export default SubtitleDisplay
