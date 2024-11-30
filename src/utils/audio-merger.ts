export interface AudioSegmentInfo {
  url: string
  startTime: number
  endTime: number
  character: string
  previousCharacter?: string
}

export class AudioMerger {
  private audioContext!: AudioContext
  private buffers: Map<string, AudioBuffer>
  private isInitialized: boolean

  // Simple pause durations (in seconds)
  private readonly PAUSE_DURATIONS = {
    SAME_SPEAKER: 0.3,    // Short pause for same speaker
    SPEAKER_CHANGE: 0.8,  // Longer pause when speaker changes
    PUNCTUATION: {
      '.': 0.6,          // Full stop
      '!': 0.6,          // Exclamation
      '?': 0.6,          // Question
      ',': 0.3,          // Comma
      ';': 0.4,          // Semicolon
      ':': 0.4           // Colon
    }
  }

  constructor() {
    this.buffers = new Map()
    this.isInitialized = false
  }

  private async initialize() {
    if (!this.isInitialized) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.isInitialized = true
    }
  }

  private async fetchAndDecodeAudio(url: string): Promise<AudioBuffer> {
    const cachedBuffer = this.buffers.get(url)
    if (cachedBuffer) {
      return cachedBuffer
    }

    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
    this.buffers.set(url, audioBuffer)
    return audioBuffer
  }

  private calculatePause(text: string, currentCharacter: string, previousCharacter?: string): number {
    let pause = 0

    // Add pause based on speaker change
    if (previousCharacter && previousCharacter !== currentCharacter) {
      pause += this.PAUSE_DURATIONS.SPEAKER_CHANGE
    } else if (previousCharacter === currentCharacter) {
      pause += this.PAUSE_DURATIONS.SAME_SPEAKER
    }

    // Add pause based on ending punctuation
    const lastChar = text.trim().slice(-1)
    if (lastChar in this.PAUSE_DURATIONS.PUNCTUATION) {
      pause += this.PAUSE_DURATIONS.PUNCTUATION[lastChar as keyof typeof this.PAUSE_DURATIONS.PUNCTUATION]
    }

    return pause
  }

  async mergeAudioSegments(segments: AudioSegmentInfo[]): Promise<Blob> {
    await this.initialize()

    // Calculate total duration including pauses
    let currentTime = 0
    const segmentsWithPauses = segments.map((segment, index) => {
      const pause = this.calculatePause(
        '', // We don't have the text here, but we can use speaker changes
        segment.character,
        index > 0 ? segments[index - 1].character : undefined
      )
      
      const startTime = currentTime + pause
      const duration = segment.endTime - segment.startTime
      currentTime = startTime + duration
      
      return {
        ...segment,
        adjustedStartTime: startTime,
        adjustedEndTime: startTime + duration
      }
    })

    // Create output buffer
    const outputBuffer = this.audioContext.createBuffer(
      2, // stereo
      Math.ceil(currentTime * this.audioContext.sampleRate),
      this.audioContext.sampleRate
    )

    // Load and merge all segments
    await Promise.all(segmentsWithPauses.map(async segment => {
      const buffer = await this.fetchAndDecodeAudio(segment.url)
      
      // Calculate start position in samples
      const startSample = Math.floor(segment.adjustedStartTime * this.audioContext.sampleRate)
      
      // Copy each channel
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const outputData = outputBuffer.getChannelData(channel)
        const inputData = buffer.getChannelData(channel)
        
        for (let i = 0; i < buffer.length; i++) {
          if (startSample + i < outputData.length) {
            outputData[startSample + i] += inputData[i]
          }
        }
      }
    }))

    // Normalize the output to prevent clipping
    for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
      const outputData = outputBuffer.getChannelData(channel)
      let maxAmplitude = 0
      
      // Find maximum amplitude
      for (let i = 0; i < outputData.length; i++) {
        const absValue = Math.abs(outputData[i])
        if (absValue > maxAmplitude) {
          maxAmplitude = absValue
        }
      }
      
      // Normalize if necessary
      if (maxAmplitude > 1) {
        const scaleFactor = 0.99 / maxAmplitude // Leave a little headroom
        for (let i = 0; i < outputData.length; i++) {
          outputData[i] *= scaleFactor
        }
      }
    }

    // Convert to WAV blob
    const offlineContext = new OfflineAudioContext(
      outputBuffer.numberOfChannels,
      outputBuffer.length,
      outputBuffer.sampleRate
    )

    const source = offlineContext.createBufferSource()
    source.buffer = outputBuffer
    source.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()

    // Convert to WAV
    const wavData = this.audioBufferToWav(renderedBuffer)
    return new Blob([wavData], { type: 'audio/wav' })
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16
    const bytesPerSample = bitDepth / 8
    const blockAlign = numChannels * bytesPerSample

    const dataLength = buffer.length * blockAlign
    const bufferLength = 44 + dataLength // WAV header is 44 bytes

    const arrayBuffer = new ArrayBuffer(bufferLength)
    const view = new DataView(arrayBuffer)

    // WAV header
    this.writeString(view, 0, 'RIFF') // ChunkID
    view.setUint32(4, bufferLength - 8, true) // ChunkSize
    this.writeString(view, 8, 'WAVE') // Format
    this.writeString(view, 12, 'fmt ') // Subchunk1ID
    view.setUint32(16, 16, true) // Subchunk1Size
    view.setUint16(20, format, true) // AudioFormat
    view.setUint16(22, numChannels, true) // NumChannels
    view.setUint32(24, sampleRate, true) // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true) // ByteRate
    view.setUint16(32, blockAlign, true) // BlockAlign
    view.setUint16(34, bitDepth, true) // BitsPerSample
    this.writeString(view, 36, 'data') // Subchunk2ID
    view.setUint32(40, dataLength, true) // Subchunk2Size

    // Write audio data
    const offset = 44
    const channelData = new Array(numChannels)
    for (let i = 0; i < numChannels; i++) {
      channelData[i] = buffer.getChannelData(i)
    }

    let index = 0
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = channelData[channel][i]
        view.setInt16(offset + index, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        index += bytesPerSample
      }
    }

    return arrayBuffer
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close()
    }
    this.buffers.clear()
    this.isInitialized = false
  }
}

// Create a singleton instance
let audioMergerInstance: AudioMerger | null = null

export function getAudioMerger(): AudioMerger {
  if (!audioMergerInstance) {
    audioMergerInstance = new AudioMerger()
  }
  return audioMergerInstance
}
