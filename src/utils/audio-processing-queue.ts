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
  private readonly baseRetryDelay = 5 * 60 * 1000 // 5 minutes base delay
  private readonly maxConcurrent = 2 // Maximum concurrent requests
  private activeRequests = 0
  private lastRequestTime = 0
  private readonly minRequestInterval = 10000 // 10 seconds between requests

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
    if (this.isProcessing || this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) {
      return
    }

    this.isProcessing = true
    const item = this.queue[0]

    try {
      // Check if we need to wait before making another request
      const timeSinceLastRequest = Date.now() - this.lastRequestTime
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest))
      }

      console.log(`[Queue] Processing item ${item.id}`)
      this.activeRequests++
      this.lastRequestTime = Date.now()
      
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
        
        // Calculate exponential backoff delay
        const backoffDelay = this.baseRetryDelay * Math.pow(2, item.retryCount - 1)
        const jitter = Math.random() * 30000 // Add up to 30 seconds of random jitter
        const delay = backoffDelay + jitter
        
        console.log(`[Queue] Rate limit hit for item ${item.id}. Moved to end of queue. Retry ${item.retryCount}/${this.maxRetries}`)
        console.log(`[Queue] Waiting ${Math.round(delay/1000/60)} minutes before next attempt`)
        
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
    } finally {
      this.activeRequests--
      this.isProcessing = false
      
      // Process next item if queue not empty and under concurrent limit
      if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
        // Add a small delay between processing items
        setTimeout(() => this.processQueue(), 1000)
      }
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
