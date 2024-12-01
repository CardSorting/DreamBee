const { Redis } = require('@upstash/redis');

class RedisManager {
    constructor() {
        this.redis = new Redis({
            url: process.env.REDIS_URL,
            token: process.env.REDIS_TOKEN
        });
        this.keyPrefix = 'audio-processor:';
        this.lockTTL = 900; // 15 minutes in seconds
    }

    getTaskKey(taskId) {
        return `${this.keyPrefix}task:${taskId}`;
    }

    getLockKey(taskId) {
        return `${this.keyPrefix}lock:${taskId}`;
    }

    getProgressKey(taskId) {
        return `${this.keyPrefix}progress:${taskId}`;
    }

    async acquireLock(taskId) {
        const lockKey = this.getLockKey(taskId);
        const acquired = await this.redis.set(lockKey, '1', {
            nx: true,
            ex: this.lockTTL
        });
        return acquired === 'OK';
    }

    async releaseLock(taskId) {
        const lockKey = this.getLockKey(taskId);
        await this.redis.del(lockKey);
    }

    async initializeTask(taskId, segments) {
        const taskKey = this.getTaskKey(taskId);
        const progressKey = this.getProgressKey(taskId);

        const taskData = {
            id: taskId,
            status: 'initializing',
            segments: segments,
            totalSegments: segments.length,
            processedSegments: 0,
            errors: [],
            startTime: Date.now(),
            lastUpdated: Date.now()
        };

        await this.redis.set(taskKey, JSON.stringify(taskData));
        await this.redis.set(progressKey, JSON.stringify({
            currentPhase: 'initializing',
            details: 'Task initialized',
            progress: 0,
            processedSegments: 0,
            totalSegments: segments.length
        }));

        return taskData;
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
            // Don't throw error to prevent task interruption
        }
    }

    async markSegmentComplete(taskId, segmentIndex, result) {
        const taskKey = this.getTaskKey(taskId);
        const taskData = await this.getTaskData(taskId);

        if (taskData) {
            taskData.processedSegments++;
            taskData.lastUpdated = Date.now();
            
            if (!taskData.processedFiles) {
                taskData.processedFiles = [];
            }
            taskData.processedFiles.push({
                index: segmentIndex,
                path: result.path,
                size: result.size
            });

            await this.redis.set(taskKey, JSON.stringify(taskData));
        }
    }

    async markSegmentError(taskId, segmentIndex, error) {
        const taskKey = this.getTaskKey(taskId);
        const taskData = await this.getTaskData(taskId);

        if (taskData) {
            if (!taskData.errors) {
                taskData.errors = [];
            }
            taskData.errors.push({
                segmentIndex,
                error: error.message,
                timestamp: Date.now()
            });
            taskData.lastUpdated = Date.now();

            await this.redis.set(taskKey, JSON.stringify(taskData));
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
            const taskData = await this.getTaskData(taskId);

            if (taskData) {
                taskData.status = 'completed';
                taskData.completedAt = Date.now();
                taskData.result = result;
                await this.redis.set(taskKey, JSON.stringify(taskData));
            }

            // Keep task data for 1 hour after completion
            await this.redis.expire(taskKey, 3600);
            await this.redis.expire(this.getProgressKey(taskId), 3600);
        } catch (error) {
            console.error('Error completing task:', error);
        }
    }

    async failTask(taskId, error) {
        try {
            const taskKey = this.getTaskKey(taskId);
            const taskData = await this.getTaskData(taskId);

            if (taskData) {
                taskData.status = 'failed';
                taskData.error = error.message;
                taskData.failedAt = Date.now();
                await this.redis.set(taskKey, JSON.stringify(taskData));
            }

            // Keep failed task data for 1 hour
            await this.redis.expire(taskKey, 3600);
            await this.redis.expire(this.getProgressKey(taskId), 3600);
        } catch (error) {
            console.error('Error failing task:', error);
        }
    }

    async cleanupTask(taskId) {
        try {
            await this.redis.del(this.getTaskKey(taskId));
            await this.redis.del(this.getProgressKey(taskId));
            await this.redis.del(this.getLockKey(taskId));
        } catch (error) {
            console.error('Error cleaning up task:', error);
        }
    }

    async isTaskActive(taskId) {
        try {
            const taskData = await this.getTaskData(taskId);
            if (!taskData) return false;

            const activeStatuses = ['initializing', 'processing', 'merging'];
            return activeStatuses.includes(taskData.status);
        } catch (error) {
            console.error('Error checking task status:', error);
            return false;
        }
    }

    async resumeTask(taskId) {
        try {
            const taskData = await this.getTaskData(taskId);
            if (!taskData) return null;

            // Only resume tasks that were interrupted
            if (taskData.status === 'completed' || taskData.status === 'failed') {
                return null;
            }

            // Check if task is stale (no updates for 5 minutes)
            const staleThreshold = 5 * 60 * 1000; // 5 minutes
            if (Date.now() - taskData.lastUpdated > staleThreshold) {
                taskData.status = 'resuming';
                await this.redis.set(this.getTaskKey(taskId), JSON.stringify(taskData));
                return taskData;
            }

            return null;
        } catch (error) {
            console.error('Error resuming task:', error);
            return null;
        }
    }
}

module.exports = RedisManager;
