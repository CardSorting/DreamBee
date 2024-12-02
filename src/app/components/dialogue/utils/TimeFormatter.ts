export class TimeFormatter {
  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  static parseTime(timeString: string): number {
    const [mins, secs] = timeString.split(':').map(Number)
    return mins * 60 + secs
  }

  static getProgressPercentage(currentTime: number, duration: number): number {
    if (duration === 0) return 0
    return (currentTime / duration) * 100
  }

  static getTimeFromPercentage(percentage: number, duration: number): number {
    return (percentage / 100) * duration
  }
}
