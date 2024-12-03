export class TimeFormatter {
  static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = Math.floor(totalSeconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  static parseTime(timeString: string): number {
    const [mins, secs] = timeString.split(':').map(Number)
    return (mins * 60 + secs) * 1000 // Return milliseconds
  }

  static getProgressPercentage(currentTimeMs: number, durationMs: number): number {
    if (durationMs === 0) return 0
    return (currentTimeMs / durationMs) * 100
  }

  static getTimeFromPercentage(percentage: number, durationMs: number): number {
    return Math.floor((percentage / 100) * durationMs)
  }

  static secondsToMs(seconds: number): number {
    return Math.floor(seconds * 1000)
  }

  static msToSeconds(ms: number): number {
    return Math.floor(ms / 1000)
  }
}
