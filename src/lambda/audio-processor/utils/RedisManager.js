const { Redis } = require('@upstash/redis');
const { TaskError } = require('./errors');

class RedisManager {
    constructor() {
        this.redis = new Redis({
            url: process.env.REDIS_URL,
            token: process.env.REDIS_TOKEN
        });
        this.keyPrefix = 'audio-processor:';
    }

    // Key generators
    getQueueKey() {
        return `${this.keyPrefix}queue`;
    }

    getTaskKey(taskId) {
        return `${this.keyPrefix}task:${taskId}`;
    }

    getProgressKey(taskId) {
        return `${this.keyPrefix}progress:${taskId}`;
    }

    getProcessingSetKey() {
        return `${this.keyPrefix}processing`;
    }

    async enqueueTask(taskId, taskData) {
        try {
            const queueKey = this.getQueueKey();
            const taskKey = this.getTaskKey(taskId);

            // Initialize task data
            const initialData = {
                id: taskId,
                status: 'queued',
                segments: taskData.segments,
                totalSegments: taskData.segments.length,
                processedSegments: 0,
                errors: [],
                startTime: Date.now(),
                lastUpdated: Date.now(),
                queuedAt: Date.now()
            };

            // Store task data
            await this.redis.set(taskKey, JSON.stringify(initialData));

            // Add to queue
            await this.redis.lpush(queueKey, taskId);

            console.log(`Task ${taskId} enqueued successfully`);
            return initialData;
        } catch (error) {
            console.error('Error enqueueing task:', error);
            throw new TaskError('Failed to enqueue task', { taskId });
        }
    }

    async dequeueTask() {
        try {
            const queueKey = this.getQueueKey();
            const processingSetKey = this.getProcessingSetKey();

            // Get next task from queue
            const taskId = await this.redis.rpoplpush(queueKey, processingSetKey);
            if (!taskId) {
                return null;
            }

            // Get task data
            const taskData = await this.getTaskData(taskId);
            if (!taskData) {
                // Clean up orphaned task ID
                await this.redis.lrem(processingSetKey, 1, taskId);
                return null;
            }

            // Update task status
            taskData.status = 'processing';
            taskData.processingStartedAt = Date.now();
            await this.redis.set(this.getTaskKey(taskId), JSON.stringify(taskData));

            console.log(`Task ${taskId} dequeued and processing`);
            return taskData;
        } catch (error) {
            console.error('Error dequeuing task:', error);
            return null;
        }
    }

    async updateTaskProgress(taskId, progress) {
        const progressKey = this.getProgressKey(taskId);
        const taskKey = this.getTaskKey(taskId);

        try {
            // Update progress
            await this.redis.set(progressKey, JSON.stringify({
                ...progress,
                lastUpdated: Date.now()
            }));

            // Update task status
            const taskData = await this.getTaskData(taskId);
            if (taskData) {
                taskData.lastUpdated = Date.now();
                taskData.processedSegments = progress.processedSegments || taskData.processedSegments;
                await this.redis.set(taskKey, JSON.stringify(taskData));
            }
        } catch (error) {
            console.error('Error updating task progress:', error);
        }
    }

    async getTaskData(taskId) {
        try {
            const taskKey = this.getTaskKey(taskId);
            const data = await this.redis.get(taskKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting task data:', error);
            return null;
        }
    }

    async getTaskProgress(taskId) {
        try {
            const progressKey = this.getProgressKey(taskId);
            const data = await this.redis.get(progressKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting task progress:', error);
            return null;
        }
    }

    async completeTask(taskId, result) {
        try {
            const taskKey = this.getTaskKey(taskId);
            const processingSetKey = this.getProcessingSetKey();
            const taskData = await this.getTaskData(taskId);

            if (taskData) {
                taskData.status = 'completed';
                taskData.completedAt = Date.now();
                taskData.result = result;
                await this.redis.set(taskKey, JSON.stringify(taskData));
            }

            // Remove from processing set
            await this.redis.lrem(processingSetKey, 1, taskId);

            // Keep task data for 1 hour after completion
            await this.redis.expire(taskKey, 3600);
            await this.redis.expire(this.getProgressKey(taskId), 3600);

            console.log(`Task ${taskId} completed successfully`);
        } catch (error) {
            console.error('Error completing task:', error);
        }
    }

    async failTask(taskId, error) {
        try {
            const taskKey = this.getTaskKey(taskId);
            const processingSetKey = this.getProcessingSetKey();
            const taskData = await this.getTaskData(taskId);

            if (taskData) {
                taskData.status = 'failed';
                taskData.error = error.message;
                taskData.failedAt = Date.now();
                await this.redis.set(taskKey, JSON.stringify(taskData));
            }

            // Remove from processing set
            await this.redis.lrem(processingSetKey, 1, taskId);

            // Keep failed task data for 1 hour
            await this.redis.expire(taskKey, 3600);
            await this.redis.expire(this.getProgressKey(taskId), 3600);

            console.log(`Task ${taskId} failed:`, error.message);
        } catch (error) {
            console.error('Error failing task:', error);
        }
    }

    async cleanupTask(taskId) {
        try {
            const processingSetKey = this.getProcessingSetKey();

            // Remove from all possible locations
            await this.redis.del(this.getTaskKey(taskId));
            await this.redis.del(this.getProgressKey(taskId));
            await this.redis.lrem(this.getQueueKey(), 0, taskId);
            await this.redis.lrem(processingSetKey, 0, taskId);

            console.log(`Task ${taskId} cleaned up`);
        } catch (error) {
            console.error('Error cleaning up task:', error);
        }
    }

    async isTaskActive(taskId) {
        try {
            const taskData = await this.getTaskData(taskId);
            if (!taskData) return false;

            const activeStatuses = ['queued', 'processing'];
            return activeStatuses.includes(taskData.status);
        } catch (error) {
            console.error('Error checking task status:', error);
            return false;
        }
    }

    async getQueueLength() {
        try {
            return await this.redis.llen(this.getQueueKey());
        } catch (error) {
            console.error('Error getting queue length:', error);
            return 0;
        }
    }

    async getProcessingCount() {
        try {
            return await this.redis.llen(this.getProcessingSetKey());
        } catch (error) {
            console.error('Error getting processing count:', error);
            return 0;
        }
    }

    async cleanupStuckTasks(maxAge = 900) { // 15 minutes default
        try {
            const processingSetKey = this.getProcessingSetKey();
            const processingTasks = await this.redis.lrange(processingSetKey, 0, -1);

            for (const taskId of processingTasks) {
                const taskData = await this.getTaskData(taskId);
                if (!taskData) {
                    await this.redis.lrem(processingSetKey, 1, taskId);
                    continue;
                }

                const age = Date.now() - taskData.lastUpdated;
                if (age > maxAge * 1000) {
                    console.log(`Found stuck task ${taskId}, age: ${age}ms`);
                    await this.cleanupTask(taskId);
                }
            }
        } catch (error) {
            console.error('Error cleaning up stuck tasks:', error);
        }
    }
}

module.exports = RedisManager;
