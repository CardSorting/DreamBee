export interface AudioSegmentInfo {
  url: string
  startTime: number
  endTime: number
  character: string
  previousCharacter?: string
}

interface MergeProgress {
  stage: 'loading' | 'processing' | 'complete'
  progress: number
  segmentIndex?: number
  totalSegments?: number
}

export class AudioMerger {
  private audioContext: AudioContext | null = null
  private buffers: Map<string, AudioBuffer> = new Map()
  private onProgress?: (progress: MergeProgress) => void
  private worker: Worker | null = null

  constructor(onProgress?: (progress: MergeProgress) => void) {
    this.onProgress = onProgress
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext()
    }
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./audio-merger.worker.ts', import.meta.url))
      this.worker.onmessage = (event) => {
        if (event.data.type === 'progress') {
          this.onProgress?.(event.data.progress)
        }
      }
    }
  }

  private async fetchAudioBuffer(url: string): Promise<AudioBuffer> {
    if (this.buffers.has(url)) {
      return this.buffers.get(url)!
    }

    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
    this.buffers.set(url, audioBuffer)
    return audioBuffer
  }

  private calculatePause(currentCharacter: string, previousCharacter?: string): number {
    const PAUSE_DURATIONS = {
      SAME_SPEAKER: 0.3,
      SPEAKER_CHANGE: 0.7,
    }
    return previousCharacter && previousCharacter !== currentCharacter
      ? PAUSE_DURATIONS.SPEAKER_CHANGE
      : PAUSE_DURATIONS.SAME_SPEAKER
  }

  async mergeAudioSegments(segments: AudioSegmentInfo[]): Promise<Blob | null> {
    if (!this.audioContext) {
      console.warn('AudioContext not supported. Falling back to simple playback.')
      return null
    }

    try {
      this.onProgress?.({ stage: 'loading', progress: 0, totalSegments: segments.length })

      const audioBuffers = await Promise.all(
        segments.map(async (segment, index) => {
          const buffer = await this.fetchAudioBuffer(segment.url)
          this.onProgress?.({
            stage: 'loading',
            progress: ((index + 1) / segments.length) * 50,
            segmentIndex: index,
            totalSegments: segments.length
          })
          return buffer
        })
      )

      if (this.worker) {
        // Use Web Worker for processing
        this.worker.postMessage({ type: 'merge', segments, audioBuffers })
        return new Promise((resolve, reject) => {
          this.worker!.onmessage = (event) => {
            if (event.data.type === 'complete') {
              resolve(new Blob([event.data.result], { type: 'audio/wav' }))
            } else if (event.data.type === 'error') {
              reject(new Error(event.data.error))
            }
          }
        })
      } else {
        // Fallback to main thread processing
        return this.processAudioInMainThread(segments, audioBuffers)
      }
    } catch (error) {
      console.error('Error merging audio:', error)
      return null
    }
  }

  private async processAudioInMainThread(segments: AudioSegmentInfo[], audioBuffers: AudioBuffer[]): Promise<Blob> {
    const offlineContext = new OfflineAudioContext(
      2,
      44100 * segments.reduce((acc, segment) => acc + segment.endTime - segment.startTime, 0),
      44100
    )

    let currentTime = 0
    segments.forEach((segment, index) => {
      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffers[index]
      source.connect(offlineContext.destination)
      
      const pauseDuration = this.calculatePause(segment.character, segment.previousCharacter)
      currentTime += pauseDuration
      source.start(currentTime)
      currentTime += source.buffer!.duration

      this.onProgress?.({
        stage: 'processing',
        progress: 50 + ((index + 1) / segments.length) * 50,
        segmentIndex: index,
        totalSegments: segments.length
      })
    })

    const renderedBuffer = await offlineContext.startRendering()
    const wavBlob = await this.audioBufferToWav(renderedBuffer)
    
    this.onProgress?.({ stage: 'complete', progress: 100 })
    return wavBlob
  }

  private async audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const interleaved = this.interleave(buffer)
    const dataView = this.createWavDataView(interleaved)
    return new Blob([dataView], { type: 'audio/wav' })
  }

  private interleave(buffer: AudioBuffer): Float32Array {
    const channels = [buffer.getChannelData(0), buffer.getChannelData(1)]
    const length = channels[0].length * 2
    const result = new Float32Array(length)
    for (let i = 0; i < length; i += 2) {
      result[i] = channels[0][i / 2]
      result[i + 1] = channels[1][i / 2]
    }
    return result
  }

  private createWavDataView(interleaved: Float32Array): DataView {
    const buffer = new ArrayBuffer(44 + interleaved.length * 2)
    const view = new DataView(buffer)

    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + interleaved.length * 2, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 2, true)
    view.setUint32(24, 44100, true)
    view.setUint32(28, 44100 * 4, true)
    view.setUint16(32, 4, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, 'data')
    view.setUint32(40, interleaved.length * 2, true)

    const length = interleaved.length
    const volume = 1
    let index = 44
    for (let i = 0; i < length; i++) {
      view.setInt16(index, interleaved[i] * (0x7FFF * volume), true)
      index += 2
    }

    return view
  }

  dispose() {
    this.audioContext?.close()
    this.worker?.terminate()
    this.buffers.clear()
  }
}

// Create a singleton instance
let audioMergerInstance: AudioMerger | null = null

export function getAudioMerger(onProgress?: (progress: MergeProgress) => void): AudioMerger {
  if (!audioMergerInstance) {
    audioMergerInstance = new AudioMerger(onProgress)
  }
  return audioMergerInstance
}
