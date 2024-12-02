import { Cue } from './VTTParser'

export interface SubtitleState {
  currentSubtitle: Cue | null
  nextSubtitle: Cue | null
}

export class SubtitleManager {
  private cues: Cue[]
  private bufferTime: number
  private timeAdjustment: number
  private lastIndex: number = -1

  constructor(
    cues: Cue[], 
    bufferTime: number = 0.3,  // Increased buffer time
    timeAdjustment: number = 0.1  // Added time adjustment for fine-tuning
  ) {
    this.cues = this.normalizeCues(cues)
    this.bufferTime = bufferTime
    this.timeAdjustment = timeAdjustment
  }

  getSubtitlesAtTime(currentTime: number): SubtitleState {
    // Apply buffer and time adjustment
    const adjustedTime = currentTime + this.bufferTime - this.timeAdjustment
    
    // Find current subtitle using binary search
    const currentIndex = this.findCueIndex(adjustedTime)
    
    // If no change in index and no current subtitle, avoid unnecessary updates
    if (currentIndex === this.lastIndex && currentIndex === -1) {
      return {
        currentSubtitle: null,
        nextSubtitle: this.findNextSubtitle(adjustedTime)
      }
    }

    this.lastIndex = currentIndex

    // Look ahead for next subtitle with buffer
    const nextSubtitle = this.findNextSubtitle(adjustedTime - this.bufferTime)

    return {
      currentSubtitle: currentIndex !== -1 ? this.cues[currentIndex] : null,
      nextSubtitle
    }
  }

  private findCueIndex(time: number): number {
    let left = 0
    let right = this.cues.length - 1

    // Add small tolerance for timing precision
    const tolerance = 0.05

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const cue = this.cues[mid]

      if (time >= cue.startTime - tolerance && time <= cue.endTime + tolerance) {
        return mid
      }

      if (time < cue.startTime) {
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    return -1
  }

  private findNextSubtitle(currentTime: number): Cue | null {
    // Find the next subtitle that starts after the current time
    // but within a reasonable preview window
    const previewWindow = 2.0 // Show next subtitle up to 2 seconds ahead
    return this.cues.find(cue => 
      cue.startTime > currentTime && 
      cue.startTime <= currentTime + previewWindow
    ) || null
  }

  private normalizeCues(cues: Cue[]): Cue[] {
    // Sort cues by start time
    const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime)

    // Ensure no gaps or overlaps between cues and adjust timing
    for (let i = 0; i < sortedCues.length; i++) {
      const cue = sortedCues[i]
      
      // Ensure minimum duration for very short cues
      const minDuration = 0.3
      if (cue.endTime - cue.startTime < minDuration) {
        cue.endTime = cue.startTime + minDuration
      }

      // Adjust timing for next cue if needed
      if (i < sortedCues.length - 1) {
        const nextCue = sortedCues[i + 1]
        
        // If there's a small gap, extend current cue
        const maxGap = 0.2
        if (nextCue.startTime - cue.endTime > 0 && nextCue.startTime - cue.endTime < maxGap) {
          cue.endTime = nextCue.startTime
        }
        
        // If there's an overlap, adjust next cue's start time
        if (cue.endTime > nextCue.startTime) {
          nextCue.startTime = cue.endTime
        }
      }
    }

    return sortedCues
  }

  updateCues(newCues: Cue[]) {
    this.cues = this.normalizeCues(newCues)
    this.lastIndex = -1
  }

  setBufferTime(time: number) {
    this.bufferTime = time
  }

  setTimeAdjustment(time: number) {
    this.timeAdjustment = time
  }

  getCues(): Cue[] {
    return this.cues
  }
}
