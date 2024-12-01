import { AudioSegment } from './elevenlabs'

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  return `${hours.toString().padStart(2, '0')}:${
    minutes.toString().padStart(2, '0')}:${
    secs.toString().padStart(2, '0')},${
    ms.toString().padStart(3, '0')}`
}

function formatVTTTimestamp(seconds: number): string {
  return formatTimestamp(seconds).replace(',', '.')
}

export function generateSRT(segments: AudioSegment[]): string {
  let srtContent = ''
  let subtitleIndex = 1

  segments.forEach(segment => {
    const text = segment.timestamps.characters.join('')
    const words = text.trim().split(/\s+/)
    let wordStartIndex = 0

    words.forEach(word => {
      // Find the word in the original text, considering potential whitespace
      const wordStartInText = text.indexOf(word, wordStartIndex)
      const wordEndInText = wordStartInText + word.length
      
      const startTime = segment.timestamps.character_start_times_seconds[wordStartInText]
      const endTime = segment.timestamps.character_end_times_seconds[wordEndInText - 1]
      
      srtContent += `${subtitleIndex}\n`
      srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(endTime)}\n`
      srtContent += `${segment.character.name}: ${word}\n\n`
      
      subtitleIndex++
      wordStartIndex = wordEndInText
    })
  })

  return srtContent
}

export function generateVTT(segments: AudioSegment[]): string {
  let vttContent = 'WEBVTT\n\n'

  segments.forEach(segment => {
    const text = segment.timestamps.characters.join('')
    const words = text.trim().split(/\s+/)
    let wordStartIndex = 0

    words.forEach(word => {
      // Find the word in the original text, considering potential whitespace
      const wordStartInText = text.indexOf(word, wordStartIndex)
      const wordEndInText = wordStartInText + word.length
      
      const startTime = segment.timestamps.character_start_times_seconds[wordStartInText]
      const endTime = segment.timestamps.character_end_times_seconds[wordEndInText - 1]
      
      vttContent += `${formatVTTTimestamp(startTime)} --> ${formatVTTTimestamp(endTime)}\n`
      vttContent += `${segment.character.name}: ${word}\n\n`
      
      wordStartIndex = wordEndInText
    })
  })

  return vttContent
}

interface WordTiming {
  word: string
  speaker: string
  startTime: number
  endTime: number
}

interface TranscriptSegment {
  speaker: string
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}

interface Transcript {
  segments: TranscriptSegment[]
  duration: number
  speakers: string[]
}

export function generateTranscript(segments: AudioSegment[]): Transcript {
  const transcript = segments.map(segment => {
    const text = segment.timestamps.characters.join('')
    const words = text.trim().split(/\s+/)
    let wordStartIndex = 0
    
    const wordTimings = words.map(word => {
      const wordStartInText = text.indexOf(word, wordStartIndex)
      const wordEndInText = wordStartInText + word.length
      
      const timing: WordTiming = {
        word,
        speaker: segment.character.name,
        startTime: segment.timestamps.character_start_times_seconds[wordStartInText],
        endTime: segment.timestamps.character_end_times_seconds[wordEndInText - 1]
      }
      
      wordStartIndex = wordEndInText
      return timing
    })

    return {
      speaker: segment.character.name,
      text: text.trim(),
      words: wordTimings,
      startTime: segment.startTime,
      endTime: segment.endTime
    }
  })

  return {
    segments: transcript,
    duration: Math.max(...segments.map(s => s.endTime)),
    speakers: Array.from(new Set(segments.map(s => s.character.name)))
  }
}
