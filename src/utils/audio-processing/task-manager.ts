import { queueManager, Task, TaskProgress, TaskStatus } from './queue-manager'
import { AudioProcessor, AudioSegment } from './audio-processor'
import { randomBytes } from 'crypto'

export interface TaskResult {
  type: TaskStatus
  taskId: string
  result?: Buffer
  status?: string
  progress?: TaskProgress
  queuePosition?: number
  error?: any
}

export class TaskManager {
  constructor(
    private readonly processor: AudioProcessor
  ) {}

  private generateTaskId(): string {
    return randomBytes(16).toString('hex')
  }

  async initializeTask(segments: AudioSegment[], conversationId: string): Promise<TaskResult> {
    const taskId = this.generateTaskId()
    
    // Check if a task for this conversation is already being processed
    const processingCount = await queueManager.getProcessingCount()
    if (processingCount > 0) {
      const existingTask = queueManager.findExistingTask(conversationId)
      if (existingTask) {
        // If task is completed, return the result
        if (existingTask.status === 'completed') {
          return {
            type: 'completed',
            taskId: existingTask.id,
            result: existingTask.result,
            status: existingTask.status,
            progress: existingTask.progress
          }
        }
        
        return {
          type: existingTask.status,
          taskId: existingTask.id,
          status: existingTask.status,
          progress: existingTask.progress
        }
      }
    }

    // Create new task
    await queueManager.createTask(taskId, segments, conversationId)

    // If we're at capacity, queue the task
    if (processingCount >= 2) {
      const queuePosition = await queueManager.queueTask(taskId)
      return {
        type: 'queued',
        taskId,
        queuePosition
      }
    }

    // Process the task immediately
    return this.processTask(taskId)
  }

  async processTask(taskId: string): Promise<TaskResult> {
    try {
      const task = await queueManager.getTask(taskId)
      if (!task) {
        throw new Error('Task not found')
      }

      // Update task status to processing
      task.status = 'processing'
      await queueManager.updateTaskProgress(taskId, {
        phase: 'processing',
        progress: 0
      })

      // Process the audio
      const result = await this.processor.processSegments(
        task.segments,
        (progress) => queueManager.updateTaskProgress(taskId, progress)
      )

      // Complete the task
      await queueManager.completeTask(taskId, result)

      return {
        type: 'completed',
        taskId,
        result
      }

    } catch (error) {
      console.error('Error processing task:', error)
      await queueManager.failTask(taskId, error)
      
      return {
        type: 'failed',
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getTaskStatus(taskId: string): Promise<TaskResult> {
    const task = await queueManager.getTask(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    return {
      type: task.status,
      taskId: task.id,
      result: task.result,
      progress: task.progress,
      error: task.error
    }
  }
}
