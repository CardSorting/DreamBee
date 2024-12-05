import { TranscriptionResponse } from '../types/transcription'

export class TranscriptFormatter {
  static formatForDynamoDB(response: TranscriptionResponse) {
    const metadata = {
      totalDuration: Math.max(...(response.utterances?.map(u => u.end) || [0])),
      speakers: response.speakers || [],
      turnCount: response.utterances?.length || 0,
      createdAt: Date.now()
    }

    const transcript = {
      srt: this.generateSRT(response),
      vtt: this.generateVTT(response),
      json: {
        subtitles: response.utterances?.map(utterance => ({
          text: utterance.text || '',
          start: utterance.start,
          end: utterance.end,
          speaker: utterance.speaker || null,
          words: utterance.words?.map(word => ({
            text: word.text || '',
            start: word.start,
            end: word.end,
            confidence: word.confidence || 0,
            speaker: word.speaker || null
          }))
        })) || []
      }
    }

    return { metadata, transcript }
  }

  private static generateSRT(response: TranscriptionResponse): string {
    if (!response.utterances?.length) return ''

    return response.utterances.map((utterance, index) => {
      const startTime = this.formatSRTTime(utterance.start)
      const endTime = this.formatSRTTime(utterance.end)
      const speaker = utterance.speaker || 'Speaker'
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${speaker}: ${utterance.text}\n`
    }).join('\n')
  }

  private static generateVTT(response: TranscriptionResponse): string {
    if (!response.utterances?.length) return 'WEBVTT\n\n'

    return 'WEBVTT\n\n' + response.utterances.map((utterance, index) => {
      const startTime = this.formatVTTTime(utterance.start)
      const endTime = this.formatVTTTime(utterance.end)
      const speaker = utterance.speaker || 'Speaker'
      
      return `${startTime} --> ${endTime}\n${speaker}: ${utterance.text}\n`
    }).join('\n')
  }

  private static formatSRTTime(seconds: number): string {
    const pad = (num: number): string => num.toString().padStart(2, '0')
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${ms.toString().padStart(3, '0')}`
  }

  private static formatVTTTime(seconds: number): string {
    const pad = (num: number): string => num.toString().padStart(2, '0')
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${ms.toString().padStart(3, '0')}`
  }
}
