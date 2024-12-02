export interface Cue {
  startTime: number
  endTime: number
  text: string
  speaker: string
}

export class VTTParser {
  static parse(vtt: string): Cue[] {
    const lines = vtt.trim().split('\n')
    const parsedCues: Cue[] = []
    let index = 0

    // Skip WebVTT header
    while (index < lines.length && (!lines[index] || lines[index].includes('WEBVTT'))) {
      index++
    }

    while (index < lines.length) {
      // Skip empty lines and numeric identifiers
      while (index < lines.length && (!lines[index] || !lines[index].includes('-->'))) {
        index++
      }

      if (index >= lines.length) break

      // Parse timestamp line
      const timestampLine = lines[index]
      const timestamps = timestampLine.split(' --> ')
      if (timestamps.length !== 2) {
        index++
        continue
      }

      const startTime = this.parseTimestamp(timestamps[0])
      const endTime = this.parseTimestamp(timestamps[1])

      // Move to content
      index++
      let text = ''
      let speaker = ''

      // Parse speaker and text
      if (index < lines.length) {
        const line = lines[index].trim()
        if (line.includes(':')) {
          const [speakerName, ...textParts] = line.split(':')
          speaker = speakerName.trim()
          text = textParts.join(':').trim()
        } else {
          text = line
        }
        index++
      }

      // Add any additional lines of text
      while (index < lines.length && lines[index].trim() !== '') {
        text += ' ' + lines[index].trim()
        index++
      }

      if (startTime >= 0 && endTime > startTime) {
        parsedCues.push({ startTime, endTime, text: text.trim(), speaker })
      }
    }

    return parsedCues.sort((a, b) => a.startTime - b.startTime)
  }

  private static parseTimestamp(timestamp: string): number {
    // Remove any leading/trailing whitespace and remove milliseconds for simplicity
    const cleanTimestamp = timestamp.trim().split('.')[0]
    const parts = cleanTimestamp.split(':')
    
    try {
      if (parts.length === 3) {
        // HH:MM:SS format
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
      } else if (parts.length === 2) {
        // MM:SS format
        return parseInt(parts[0]) * 60 + parseInt(parts[1])
      }
    } catch (error) {
      console.warn('Invalid timestamp format:', timestamp)
    }
    
    return 0
  }
}
