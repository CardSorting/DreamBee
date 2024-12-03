import { AudioSegment } from './google-tts'

interface AssemblyAIUtterance {
  text: string
  start: number
  end: number
  speaker?: string
}

interface Subtitle {
  text: string
  start: number
  end: number
  words: Word[]
  speaker?: string | null
}

interface Word {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
}

// Legacy functions for backward compatibility
export function generateSRT(segments: AudioSegment[]): string {
  let srtContent = ''
  let index = 1

  segments.forEach(segment => {
    const { timestamps } = segment

    for (let i = 0; i < timestamps.characters.length; i++) {
      const startTime = timestamps.character_start_times_seconds[i]
      const endTime = timestamps.character_end_times_seconds[i]
      const char = timestamps.characters[i]

      const startSRT = formatSRTTime(startTime)
      const endSRT = formatSRTTime(endTime)

      srtContent += `${index}\n`
      srtContent += `${startSRT} --> ${endSRT}\n`
      srtContent += `${char}\n\n`

      index++
    }
  })

  return srtContent
}

export function generateVTT(segments: AudioSegment[]): string {
  let vttContent = 'WEBVTT\n\n'

  segments.forEach(segment => {
    const startVTT = formatVTTTime(segment.startTime)
    const endVTT = formatVTTTime(segment.endTime)
    const text = segment.timestamps.characters.join('')

    vttContent += `${startVTT} --> ${endVTT}\n`
    vttContent += `<v ${segment.character.name}>${text}</v>\n\n`
  })

  return vttContent
}

// New AssemblyAI-based functions
export function generateAssemblyAIVTT(subtitles: Subtitle[]): string {
  let vttContent = 'WEBVTT\n\n'

  subtitles.forEach((subtitle) => {
    const startVTT = formatVTTTime(subtitle.start)
    const endVTT = formatVTTTime(subtitle.end)
    const speaker = subtitle.speaker || 'Speaker'

    vttContent += `${startVTT} --> ${endVTT}\n`
    vttContent += `<v ${speaker}>${subtitle.text}</v>\n\n`
  })

  return vttContent
}

export function generateAssemblyAISRT(subtitles: Subtitle[]): string {
  let srtContent = ''
  let index = 1

  subtitles.forEach((subtitle) => {
    const startSRT = formatSRTTime(subtitle.start)
    const endSRT = formatSRTTime(subtitle.end)
    const speaker = subtitle.speaker || 'Speaker'

    srtContent += `${index}\n`
    srtContent += `${startSRT} --> ${endSRT}\n`
    srtContent += `${speaker}: ${subtitle.text}\n\n`

    index++
  })

  return srtContent
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)},${padZeroMillis(milliseconds)}`
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)}.${padZeroMillis(milliseconds)}`
}

function padZero(num: number): string {
  return num.toString().padStart(2, '0')
}

function padZeroMillis(num: number): string {
  return num.toString().padStart(3, '0')
}
