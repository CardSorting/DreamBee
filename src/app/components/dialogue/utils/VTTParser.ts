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
      // Skip empty lines, numeric identifiers, and NOTE lines
      while (index < lines.length && (!lines[index] || !lines[index].includes('-->') || lines[index].startsWith('NOTE'))) {
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
        
        // Handle AssemblyAI <v> tag format
        if (line.startsWith('<v ')) {
          const match = line.match(/<v ([^>]+)>(.+)<\/v>/)
          if (match) {
            speaker = match[1].trim()
            text = match[2].trim()
          } else {
            // Fallback to regular text if <v> tag is malformed
            text = line.replace(/<\/?v[^>]*>/g, '').trim()
          }
        } else if (line.includes(':')) {
          // Handle traditional format with speaker:text
          const [speakerName, ...textParts] = line.split(':')
          speaker = speakerName.trim()
          text = textParts.join(':').trim()
        } else {
          // No speaker identified
          text = line
          speaker = 'Speaker'
        }
        index++
      }

      // Add any additional lines of text
      while (index < lines.length && lines[index].trim() !== '') {
        const additionalLine = lines[index].trim()
        // Handle continuation of <v> tag content
        if (additionalLine.endsWith('</v>')) {
          text += ' ' + additionalLine.replace(/<\/v>$/, '').trim()
        } else {
          text += ' ' + additionalLine
        }
        index++
      }

      if (startTime >= 0 && endTime > startTime) {
        parsedCues.push({ 
          startTime, 
          endTime, 
          text: text.trim(),
          speaker: speaker || 'Speaker'
        })
      }
    }

    return parsedCues.sort((a, b) => a.startTime - b.startTime)
  }

  private static parseTimestamp(timestamp: string): number {
    // Handle both HH:MM:SS.mmm and MM:SS.mmm formats
    const [time, milliseconds] = timestamp.trim().split('.')
    const parts = time.split(':')
    
    try {
      if (parts.length === 3) {
        // HH:MM:SS format
        const hours = parseInt(parts[0])
        const minutes = parseInt(parts[1])
        const seconds = parseInt(parts[2])
        const ms = milliseconds ? parseInt(milliseconds) / 1000 : 0
        return hours * 3600 + minutes * 60 + seconds + ms
      } else if (parts.length === 2) {
        // MM:SS format
        const minutes = parseInt(parts[0])
        const seconds = parseInt(parts[1])
        const ms = milliseconds ? parseInt(milliseconds) / 1000 : 0
        return minutes * 60 + seconds + ms
      }
    } catch (error) {
      console.warn('Invalid timestamp format:', timestamp)
    }
    
    return 0
  }
}
