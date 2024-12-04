import { getAudioProcessor } from './assemblyai'

interface QueueItem {
  id: string
  audioUrl: string
  options: {
    speakerDetection?: boolean
    wordTimestamps?: boolean
    speakerNames?: string[]
  }
  onProgress?: (progress: number) => void
  resolve: (result: any) => void
  reject: (error: any) => void
  retryCount: number
}

class AudioProcessingQueue {
  private static instance: AudioProcessingQueue
  private queue: QueueItem[] = []
  private isProcessing = false
  private readonly maxRetries = 3
  private readonly minRetryDelay = 60 * 60 * 1000 // 1 hour in milliseconds

  private constructor() {}

  static getInstance(): AudioProcessingQueue {
    if (!AudioProcessingQueue.instance) {
      AudioProcessingQueue.instance = new AudioProcessingQueue()
    }
    return AudioProcessingQueue.instance
  }

  async enqueue(
    audioUrl: string,
    options: {
      speakerDetection?: boolean
      wordTimestamps?: boolean
      speakerNames?: string[]
    } = {},
    onProgress?: (progress: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7)
      this.queue.push({
        id,
        audioUrl,
        options,
        onProgress,
        resolve,
        reject,
        retryCount: 0
      })
      console.log(`[Queue] Added item ${id} to queue. Queue length: ${this.queue.length}`)
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true
    const item = this.queue[0]

    try {
      console.log(`[Queue] Processing item ${item.id}`)
      const processor = getAudioProcessor()
      const result = await processor.generateSubtitles(
        item.audioUrl,
        item.options,
        item.onProgress
      )
      
      // Success - remove from queue and resolve
      this.queue.shift()
      item.resolve(result)
      console.log(`[Queue] Successfully processed item ${item.id}`)
    } catch (error: any) {
      console.error(`[Queue] Error processing item ${item.id}:`, error)

      if (error.message?.includes('rate limit') && item.retryCount < this.maxRetries) {
        // Rate limit hit - move to end of queue with increased retry count
        item.retryCount++
        this.queue.shift()
        this.queue.push(item)
        console.log(`[Queue] Rate limit hit for item ${item.id}. Moved to end of queue. Retry ${item.retryCount}/${this.maxRetries}`)
        
        // Wait before processing next item
        const delay = this.minRetryDelay
        console.log(`[Queue] Waiting ${delay/1000/60} minutes before processing next item`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (error.message?.includes('rate limit')) {
        // Max retries exceeded - remove from queue and reject
        this.queue.shift()
        item.reject(new Error(`Failed to process audio after ${this.maxRetries} retries due to rate limits`))
      } else {
        // Other error - remove from queue and reject
        this.queue.shift()
        item.reject(error)
      }
    }

    this.isProcessing = false
    
    // Process next item if queue not empty
    if (this.queue.length > 0) {
      this.processQueue()
    }
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getQueueStatus(): { id: string; retryCount: number }[] {
    return this.queue.map(item => ({
      id: item.id,
      retryCount: item.retryCount
    }))
  }
}

export const audioQueue = AudioProcessingQueue.getInstance()
