export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface TaskProgress {
  phase: string
  progress: number
  details?: any
}

export interface Task {
  id: string
  status: TaskStatus
  segments: any[]
  conversationId: string
  progress?: TaskProgress
  result?: Buffer
  error?: any
  timestamp: number
}

export class QueueManager {
  private tasks = new Map<string, Task>()
  private queue: string[] = []
  private processing = new Set<string>()
  private maxConcurrent = 2

  async createTask(taskId: string, segments: any[], conversationId: string): Promise<void> {
    const task: Task = {
      id: taskId,
      status: 'queued',
      segments,
      conversationId,
      timestamp: Date.now()
    }
    
    this.tasks.set(taskId, task)
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null
  }

  async updateTaskProgress(taskId: string, progress: TaskProgress): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task) {
      task.progress = progress
    }
  }

  async completeTask(taskId: string, result: Buffer): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'completed'
      task.result = result
      this.processing.delete(taskId)
    }
  }

  async failTask(taskId: string, error: any): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      this.processing.delete(taskId)
    }
  }

  async queueTask(taskId: string): Promise<number> {
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'queued'
      this.queue.push(taskId)
    }
    return this.queue.length
  }

  async dequeueTask(): Promise<Task | null> {
    if (this.processing.size >= this.maxConcurrent) {
      return null
    }

    const taskId = this.queue.shift()
    if (!taskId) return null

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'processing'
      this.processing.add(taskId)
      return task
    }

    return null
  }

  async getQueueLength(): Promise<number> {
    return this.queue.length
  }

  async getProcessingCount(): Promise<number> {
    return this.processing.size
  }

  findExistingTask(conversationId: string): Task | null {
    // Check processing tasks
    const tasks = Array.from(this.tasks.values())
    for (const task of tasks) {
      if (task.conversationId === conversationId && 
         (task.status === 'processing' || task.status === 'completed')) {
        return task
      }
    }
    return null
  }

  // Clean up old tasks periodically
  cleanupOldTasks(maxAge: number = 30 * 60 * 1000): void {
    const now = Date.now()
    const tasks = Array.from(this.tasks.entries())
    for (const [taskId, task] of tasks) {
      if (now - task.timestamp > maxAge) {
        this.tasks.delete(taskId)
      }
    }
  }
}

// Create singleton instance
export const queueManager = new QueueManager()
