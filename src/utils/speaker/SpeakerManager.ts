import { Speaker } from '../types/speaker'

export class SpeakerManager {
  private speakers: Map<string, Speaker>

  constructor(speakers: Speaker[]) {
    this.speakers = new Map()
    this.initializeSpeakers(speakers)
  }

  private initializeSpeakers(speakers: Speaker[]) {
    speakers.forEach(speaker => {
      this.speakers.set(speaker.name.toLowerCase(), speaker)
    })
  }

  getSpeaker(name: string): Speaker | undefined {
    return this.speakers.get(name.toLowerCase())
  }

  getAllSpeakers(): Speaker[] {
    return Array.from(this.speakers.values())
  }

  getSpeakerNames(): string[] {
    return Array.from(this.speakers.keys())
  }

  addSpeaker(speaker: Speaker) {
    this.speakers.set(speaker.name.toLowerCase(), speaker)
  }

  removeSpeaker(name: string) {
    this.speakers.delete(name.toLowerCase())
  }

  hasSpeaker(name: string): boolean {
    return this.speakers.has(name.toLowerCase())
  }
}
