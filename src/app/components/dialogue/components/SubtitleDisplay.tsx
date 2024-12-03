import { useRef, memo } from 'react'
import { SubtitleDisplayProps } from '../utils/types'
import { SubtitleStyleManager } from '../utils/SubtitleStyleManager'

interface Word {
  text: string
  start: number
  end: number
}

const SubtitleDisplay = ({ currentSubtitle, nextSubtitle, currentTime }: SubtitleDisplayProps) => {
  const styleManager = useRef(new SubtitleStyleManager())

  // If no subtitles at all, show an empty state
  if (!currentSubtitle) {
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

  // Split text into words with timing information
  const words: Word[] = currentSubtitle.words || currentSubtitle.text.split(' ').map((word: string, index: number, array: string[]) => {
    // If no word-level timing, distribute evenly across subtitle duration
    const duration = currentSubtitle.end - currentSubtitle.start
    const wordDuration = duration / array.length
    const start = currentSubtitle.start + (index * wordDuration)
    return {
      text: word,
      start,
      end: start + wordDuration
    }
  })

  return (
    <div className={styleManager.current.getContainerStyles()}>
      <div className={styleManager.current.getWrapperStyles()}>
        <div className={styleManager.current.getSubtitleStyles('current')}>
          <div className={styleManager.current.getSpeakerStyles('current')}>
            {currentSubtitle.speaker || 'Speaker'}
          </div>
          <div 
            className={`${styleManager.current.getTextStyles('current')} mt-1 flex flex-wrap gap-1`}
          >
            {words.map((word, index) => (
              <span
                key={`${word.text}-${index}-${currentSubtitle.id || ''}`}
                className={`transition-colors duration-200 ${
                  currentTime >= word.start && currentTime <= word.end
                    ? 'text-blue-600 font-medium'
                    : ''
                }`}
              >
                {word.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(SubtitleDisplay)
