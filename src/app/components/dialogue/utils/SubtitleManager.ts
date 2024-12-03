import { Cue } from './VTTParser'

export interface SubtitleState {
  currentSubtitle: Cue | null
  nextSubtitle: Cue | null
}

export class SubtitleManager {
  private cues: Cue[]
  private lastIndex: number = -1

  constructor(cues: Cue[]) {
    this.cues = this.sortCues(cues)
  }

  getSubtitlesAtTime(currentTime: number): SubtitleState {
    // Find current subtitle using binary search
    const currentIndex = this.findCueIndex(currentTime)
    
    // If no change in index and no current subtitle, avoid unnecessary updates
    if (currentIndex === this.lastIndex && currentIndex === -1) {
      return {
        currentSubtitle: null,
        nextSubtitle: this.findNextSubtitle(currentTime)
      }
    }

    this.lastIndex = currentIndex

    // Look ahead for next subtitle
    const nextSubtitle = this.findNextSubtitle(currentTime)

    return {
      currentSubtitle: currentIndex !== -1 ? this.cues[currentIndex] : null,
      nextSubtitle
    }
  }

  private findCueIndex(time: number): number {
    let left = 0
    let right = this.cues.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const cue = this.cues[mid]

      if (time >= cue.startTime && time <= cue.endTime) {
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
    return this.cues.find(cue => cue.startTime > currentTime) || null
  }

  private sortCues(cues: Cue[]): Cue[] {
    // Simply sort cues by start time, no additional adjustments needed
    return [...cues].sort((a, b) => a.startTime - b.startTime)
  }

  updateCues(newCues: Cue[]) {
    this.cues = this.sortCues(newCues)
    this.lastIndex = -1
  }

  getCues(): Cue[] {
    return this.cues
  }
}
