const crypto = require('crypto');

class TaskManager {
    constructor(redis, processor) {
        this.redis = redis;
        this.processor = processor;
        this.currentTask = null;
    }

    generateTaskId(conversationId, segments) {
        const hash = crypto.createHash('md5');
        // Include all segment URLs and timestamps in the hash
        const segmentData = segments.map(s => 
            `${s.url}:${s.startTime}:${s.endTime}`
        ).join('|');
        hash.update(conversationId + segmentData);
        return `${conversationId}-${hash.digest('hex').substring(0, 8)}`;
    }

    extractConversationId(event) {
        if (event.conversationId) {
            return event.conversationId;
        }
        
        // Try to extract from first segment URL
        if (event.segments && event.segments[0] && event.segments[0].url) {
            const match = event.segments[0].url.match(/conversations\/([^\/]+)/);
            if (match) {
                return match[1];
            }
        }
        
        return 'unknown';
    }

    async initializeTask(event) {
        try {
            const conversationId = this.extractConversationId(event);
            const taskId = this.generateTaskId(conversationId, event.segments || []);
            
            // Check for existing task
            const existingTask = await this.redis.getTaskData(taskId);
            if (existingTask) {
                console.log(`Found existing task: ${taskId}, status: ${existingTask.status}`);
                
                if (existingTask.status === 'completed') {
                    return {
                        type: 'completed',
                        result: existingTask.result
                    };
                }
                
                if (existingTask.status === 'failed') {
                    // Clean up failed task and allow retry
                    await this.redis.cleanupTask(taskId);
                } else {
                    // Task is still processing
                    return {
                        type: 'conflict',
                        taskId,
                        status: existingTask.status,
                        progress: await this.redis.getTaskProgress(taskId)
                    };
                }
            }

            // Try to acquire lock
            const lockAcquired = await this.redis.acquireLock(taskId);
            if (!lockAcquired) {
                return {
                    type: 'conflict',
                    taskId,
                    message: 'Task is already being processed'
                };
            }

            // Initialize task in Redis
            await this.redis.initializeTask(taskId, event.segments || []);
            
            this.currentTask = {
                id: taskId,
                conversationId,
                segments: event.segments || [],
                startTime: Date.now()
            };

            return {
                type: 'initialized',
                taskId
            };
        } catch (error) {
            console.error('Error initializing task:', error);
            throw new Error(`Failed to initialize task: ${error.message}`);
        }
    }

    async updateProgress(progress) {
        if (!this.currentTask) {
            console.warn('No active task for progress update');
            return;
        }

        try {
            const progressData = {
                ...progress,
                taskId: this.currentTask.id,
                conversationId: this.currentTask.conversationId,
                elapsedTime: Date.now() - this.currentTask.startTime
            };

            await this.redis.updateTaskProgress(this.currentTask.id, progressData);
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    }

    async completeTask(result) {
        if (!this.currentTask) {
            console.warn('No active task to complete');
            return;
        }

        try {
            const taskResult = {
                ...result,
                taskId: this.currentTask.id,
                conversationId: this.currentTask.conversationId,
                processingTime: Date.now() - this.currentTask.startTime
            };

            await this.redis.completeTask(this.currentTask.id, taskResult);
            return taskResult;
        } catch (error) {
            console.error('Error completing task:', error);
            throw error;
        }
    }

    async failTask(error) {
        if (!this.currentTask) {
            console.warn('No active task to fail');
            return;
        }

        try {
            const errorData = {
                message: error.message,
                details: error.details || error.stack,
                taskId: this.currentTask.id,
                conversationId: this.currentTask.conversationId,
                processingTime: Date.now() - this.currentTask.startTime
            };

            await this.redis.failTask(this.currentTask.id, errorData);
            return errorData;
        } catch (error) {
            console.error('Error marking task as failed:', error);
            throw error;
        }
    }

    async cleanup() {
        if (!this.currentTask) {
            return;
        }

        try {
            await this.redis.releaseLock(this.currentTask.id);
            this.currentTask = null;
        } catch (error) {
            console.error('Error during task cleanup:', error);
        }
    }

    async processTask(event) {
        try {
            const initResult = await this.initializeTask(event);
            
            if (initResult.type !== 'initialized') {
                return this.formatResponse(initResult);
            }

            // Handle test event
            if (event.test) {
                return {
                    statusCode: 200,
                    body: {
                        message: 'Test successful',
                        taskId: this.currentTask.id,
                        redis: {
                            url: process.env.REDIS_URL ? 'configured' : 'missing',
                            token: process.env.REDIS_TOKEN ? 'configured' : 'missing'
                        }
                    }
                };
            }

            // Set up progress tracking
            this.processor.onProgress = progress => this.updateProgress(progress);

            // Process audio segments
            const result = await this.processor.process(event.segments);

            // Mark task as complete
            const completedResult = await this.completeTask(result);

            return this.formatResponse({
                type: 'completed',
                result: completedResult
            });

        } catch (error) {
            console.error('Error processing task:', error);
            const errorData = await this.failTask(error);
            
            return {
                statusCode: 500,
                body: {
                    error: error.message,
                    details: errorData,
                    taskId: this.currentTask?.id
                }
            };
        } finally {
            await this.cleanup();
        }
    }

    formatResponse(result) {
        try {
            switch (result.type) {
                case 'completed':
                    return {
                        statusCode: 200,
                        body: result.result
                    };
                case 'conflict':
                    return {
                        statusCode: 409,
                        body: {
                            message: result.message || 'Task is already being processed',
                            taskId: result.taskId,
                            status: result.status,
                            progress: result.progress
                        }
                    };
                default:
                    return {
                        statusCode: 500,
                        body: {
                            message: 'Unknown result type',
                            type: result.type
                        }
                    };
            }
        } catch (error) {
            console.error('Error formatting response:', error);
            return {
                statusCode: 500,
                body: {
                    error: 'Error formatting response',
                    details: error.message
                }
            };
        }
    }
}

module.exports = TaskManager;
