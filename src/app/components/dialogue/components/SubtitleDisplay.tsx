import { useRef, memo } from 'react'
import { SubtitleDisplayProps } from '../utils/types'
import { SubtitleStyleManager } from '../utils/SubtitleStyleManager'

const SubtitleDisplay = ({ currentSubtitle, nextSubtitle }: SubtitleDisplayProps) => {
  const styleManager = useRef(new SubtitleStyleManager())

  // If no current subtitle, show the next subtitle as current
  if (!currentSubtitle && nextSubtitle) {
    currentSubtitle = nextSubtitle
    nextSubtitle = null
  }

  // If no subtitles at all, show an empty state
  if (!currentSubtitle && !nextSubtitle) {
    return (
      <div className={styleManager.current.getContainerStyles()}>
        <div className={styleManager.current.getWrapperStyles()}>
          <div className={styleManager.current.getSubtitleStyles('current')}>
            <div className={styleManager.current.getSpeakerStyles('current')}>
              &nbsp;
            </div>
            <div className={`${styleManager.current.getTextStyles('current')} mt-1`}>
              &nbsp;
            </div>
          </div>
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
            >
              {currentSubtitle.text || ''}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {currentSubtitle.start}ms - {currentSubtitle.end}ms
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
            >
              {nextSubtitle.text || ''}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {nextSubtitle.start}ms - {nextSubtitle.end}ms
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(SubtitleDisplay)
