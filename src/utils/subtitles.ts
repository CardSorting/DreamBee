import { AudioSegment } from './google-tts'

export function generateSRT(segments: AudioSegment[]): string {
  let srtContent = ''
  let index = 1

  segments.forEach(segment => {
    const { timestamps } = segment

    for (let i = 0; i < timestamps.characters.length; i++) {
      const startTime = timestamps.character_start_times_seconds[i]
      const endTime = timestamps.character_end_times_seconds[i]
      const char = timestamps.characters[i]

      // Format times as SRT timestamps (HH:MM:SS,mmm)
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
    const { timestamps } = segment

    for (let i = 0; i < timestamps.characters.length; i++) {
      const startTime = timestamps.character_start_times_seconds[i]
      const endTime = timestamps.character_end_times_seconds[i]
      const char = timestamps.characters[i]

      // Format times as VTT timestamps (HH:MM:SS.mmm)
      const startVTT = formatVTTTime(startTime)
      const endVTT = formatVTTTime(endTime)

      vttContent += `${startVTT} --> ${endVTT}\n`
      vttContent += `${char}\n\n`
    }
  })

  return vttContent
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
