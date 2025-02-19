import { AudioSegmentInfo } from './audio-merger'

interface MergeProgress {
  stage: 'loading' | 'processing' | 'complete'
  progress: number
  segmentIndex?: number
  totalSegments?: number
}

export class WebAudioMerger {
  private audioContext: AudioContext
  private onProgress?: (progress: MergeProgress) => void
  private abortController: AbortController

  constructor(onProgress?: (progress: MergeProgress) => void) {
    this.audioContext = new AudioContext()
    this.onProgress = onProgress
    this.abortController = new AbortController()
  }

  private async fetchAudioBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url, { signal: this.abortController.signal })
    const arrayBuffer = await response.arrayBuffer()
    return await this.audioContext.decodeAudioData(arrayBuffer)
  }

  private async downloadSegments(segments: AudioSegmentInfo[]): Promise<AudioBuffer[]> {
    const buffers: AudioBuffer[] = []
    
    for (let i = 0; i < segments.length; i++) {
      this.onProgress?.({
        stage: 'loading',
        progress: (i / segments.length) * 50, // First 50% is downloading
        segmentIndex: i,
        totalSegments: segments.length
      })
      
      const buffer = await this.fetchAudioBuffer(segments[i].url)
      buffers.push(buffer)
    }
    
    return buffers
  }

  async mergeAudioSegments(segments: AudioSegmentInfo[]): Promise<{ blob: Blob, timingAdjustments: { [key: string]: number } }> {
    try {
      // Download all audio segments
      const buffers = await this.downloadSegments(segments)
      
      // Calculate proper start times to prevent overlaps
      let currentTime = 0
      const adjustedSegments = segments.map((segment, index) => {
        const buffer = buffers[index]
        const startTime = currentTime
        currentTime += buffer.duration + 0.5 // Add 0.5s gap between segments
        return {
          ...segment,
          adjustedStartTime: startTime,
          duration: buffer.duration,
          timeOffset: startTime - segment.startTime // Calculate time offset
        }
      })
      
      // Calculate total duration based on adjusted timings
      const totalDuration = currentTime + 0.5 // Add final padding
      const outputBuffer = this.audioContext.createBuffer(
        2, // Number of channels (stereo)
        Math.ceil(this.audioContext.sampleRate * totalDuration),
        this.audioContext.sampleRate
      )

      // Clear the output buffer
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const outputData = outputBuffer.getChannelData(channel)
        outputData.fill(0)
      }
      
      // Process each segment
      for (let i = 0; i < segments.length; i++) {
        this.onProgress?.({
          stage: 'processing',
          progress: 50 + (i / segments.length) * 50,
          segmentIndex: i,
          totalSegments: segments.length
        })
        
        const segment = adjustedSegments[i]
        const buffer = buffers[i]
        
        // Use adjusted start time
        const startSample = Math.floor(segment.adjustedStartTime * this.audioContext.sampleRate)
        
        // Copy each channel
        for (let channel = 0; channel < Math.min(buffer.numberOfChannels, outputBuffer.numberOfChannels); channel++) {
          const channelData = buffer.getChannelData(channel)
          outputBuffer.copyToChannel(channelData, channel, startSample)
        }
      }
      
      // Normalize to prevent clipping
      let maxAmplitude = 0
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const outputData = outputBuffer.getChannelData(channel)
        for (let i = 0; i < outputData.length; i++) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(outputData[i]))
        }
      }
      
      // Apply normalization if needed
      if (maxAmplitude > 1) {
        const scale = 0.99 / maxAmplitude // Leave a tiny bit of headroom
        for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
          const outputData = outputBuffer.getChannelData(channel)
          for (let i = 0; i < outputData.length; i++) {
            outputData[i] *= scale
          }
        }
      }

      // Create timing adjustments map for subtitle synchronization
      const timingAdjustments = adjustedSegments.reduce((acc, segment) => {
        acc[segment.character] = segment.timeOffset
        return acc
      }, {} as { [key: string]: number })

      // Convert to WAV format and return with timing adjustments
      const wavData = this.audioBufferToWav(outputBuffer)
      return {
        blob: new Blob([wavData], { type: 'audio/wav' }),
        timingAdjustments
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unknown error occurred during audio merge')
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChan = buffer.numberOfChannels
    const length = buffer.length * numOfChan * 2
    const buffer2 = new ArrayBuffer(44 + length)
    const view = new DataView(buffer2)
    const channels = []
    let sample
    let offset = 0
    let pos = 0

    // Write WAV header
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + length, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numOfChan, true)
    view.setUint32(24, buffer.sampleRate, true)
    view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true)
    view.setUint16(32, numOfChan * 2, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, 'data')
    view.setUint32(40, length, true)

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    while (pos < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(44 + offset, sample, true)
        offset += 2
      }
      pos++
    }

    return buffer2
  }

  abort() {
    this.abortController.abort()
    this.abortController = new AbortController()
  }
}

// Create a singleton instance
let webAudioMergerInstance: WebAudioMerger | null = null

export function getWebAudioMerger(onProgress?: (progress: MergeProgress) => void): WebAudioMerger {
  if (!webAudioMergerInstance || onProgress) {
    webAudioMergerInstance = new WebAudioMerger(onProgress)
  }
  return webAudioMergerInstance
}
