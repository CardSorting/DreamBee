import React from 'react'
import { Cue } from '../utils/VTTParser'
import { SubtitleStyleManager } from '../utils/SubtitleStyleManager'

interface SubtitleDisplayProps {
  currentCue: Cue | null
  nextCue: Cue | null
  styleManager?: SubtitleStyleManager
}

const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({
  currentCue,
  nextCue,
  styleManager = new SubtitleStyleManager()
}) => {
  return (
    <div className={styleManager.getContainerStyles()}>
      <div className={styleManager.getWrapperStyles()}>
        <div className={styleManager.getSubtitleStyles('current')}>
          <div className={styleManager.getSpeakerStyles('current')}>
            {currentCue?.speaker || 'Person speaking'}
          </div>
          <div className={styleManager.getTextStyles('current')}>
            {currentCue?.text || ''}
          </div>
        </div>
        
        {nextCue && (
          <div className={styleManager.getSubtitleStyles('next')}>
            <div className={styleManager.getSpeakerStyles('next')}>
              {nextCue.speaker || 'Person speaking'}
            </div>
            <div className={styleManager.getTextStyles('next')}>
              {nextCue.text}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubtitleDisplay
