const crypto = require('crypto');
const S3RouteManager = require('./S3RouteManager');
const { TaskError } = require('./errors');

class TaskManager {
    constructor(redis, processor, s3) {
        this.redis = redis;
        this.processor = processor;
        this.s3Routes = new S3RouteManager(s3);
        this.currentTask = null;
    }

    generateTaskId(conversationId, segments) {
        const hash = crypto.createHash('md5');
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
            
            console.log('Initializing task:', {
                taskId,
                conversationId,
                segmentCount: event.segments?.length || 0
            });

            // Check for existing task
            const existingTask = await this.redis.getTaskData(taskId);
            if (existingTask) {
                console.log(`Found existing task: ${taskId}`, {
                    status: existingTask.status,
                    queuedAt: existingTask.queuedAt,
                    elapsedTime: Date.now() - existingTask.queuedAt
                });
                
                if (existingTask.status === 'completed') {
                    return {
                        type: 'completed',
                        result: existingTask.result
                    };
                }
                
                if (existingTask.status === 'failed') {
                    // Allow retry of failed tasks
                    await this.redis.cleanupTask(taskId);
                } else {
                    // Task is queued or processing
                    return {
                        type: 'conflict',
                        taskId,
                        status: existingTask.status,
                        progress: await this.redis.getTaskProgress(taskId)
                    };
                }
            }

            // Enqueue new task
            const queuedTask = await this.redis.enqueueTask(taskId, {
                segments: event.segments || []
            });

            this.currentTask = {
                id: taskId,
                conversationId,
                segments: event.segments || [],
                startTime: Date.now()
            };

            // Get queue position
            const queueLength = await this.redis.getQueueLength();
            const processingCount = await this.redis.getProcessingCount();

            return {
                type: 'queued',
                taskId,
                queuePosition: queueLength,
                activeProcesses: processingCount
            };
        } catch (error) {
            console.error('Error initializing task:', error);
            throw new TaskError('Failed to initialize task', {
                cause: error,
                taskId: this.currentTask?.id
            });
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

    async handleAudioResult(result) {
        try {
            let uploadResult;
            if (result.data) {
                uploadResult = await this.s3Routes.uploadMergedAudio(
                    this.currentTask.conversationId,
                    this.currentTask.id,
                    result.data,
                    result.format || 'mp3'
                );
            } else if (result.path) {
                uploadResult = await this.s3Routes.uploadMergedAudio(
                    this.currentTask.conversationId,
                    this.currentTask.id,
                    result.path,
                    result.format || 'mp3'
                );
            } else {
                throw new Error('No audio data available');
            }

            const progress = await this.redis.getTaskProgress(this.currentTask.id);

            return {
                url: uploadResult.url,
                format: result.format || 'mp3',
                size: uploadResult.size,
                taskId: this.currentTask.id,
                progress
            };
        } catch (error) {
            throw new TaskError('Failed to handle audio result', {
                cause: error,
                taskId: this.currentTask.id
            });
        } finally {
            try {
                await this.s3Routes.cleanupTempFiles(this.currentTask.conversationId);
            } catch (cleanupError) {
                console.error('Error cleaning up temp files:', cleanupError);
            }
        }
    }

    async completeTask(result) {
        if (!this.currentTask) {
            console.warn('No active task to complete');
            return;
        }

        try {
            if (result.data || result.path) {
                result = await this.handleAudioResult(result);
            }

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
            await this.s3Routes.cleanupTempFiles(this.currentTask.conversationId);
            this.currentTask = null;
        } catch (error) {
            console.error('Error during task cleanup:', error);
        }
    }

    async processTask(event) {
        try {
            const initResult = await this.initializeTask(event);
            
            if (initResult.type === 'completed' || initResult.type === 'conflict') {
                return this.formatResponse(initResult);
            }

            // Handle test event
            if (event.test) {
                return {
                    statusCode: 200,
                    body: {
                        message: 'Test successful',
                        environment: {
                            redis: {
                                url: process.env.REDIS_URL ? 'configured' : 'missing',
                                token: process.env.REDIS_TOKEN ? 'configured' : 'missing'
                            },
                            temp: process.env.TEMP_DIR ? 'configured' : 'missing',
                            memory: process.env.NODE_OPTIONS ? 'configured' : 'missing'
                        },
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Set up progress tracking
            this.processor.onProgress = progress => this.updateProgress(progress);

            // Process audio segments
            const result = await this.processor.process(event.segments);

            // Mark task as complete and handle audio data
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
                    error: 'Failed to process audio',
                    details: {
                        message: error.message,
                        details: errorData,
                        taskId: this.currentTask?.id,
                        conversationId: this.currentTask?.conversationId,
                        processingTime: this.currentTask ? Date.now() - this.currentTask.startTime : 0
                    }
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
                case 'queued':
                    return {
                        statusCode: 202,
                        body: {
                            message: 'Task queued successfully',
                            taskId: result.taskId,
                            queuePosition: result.queuePosition,
                            activeProcesses: result.activeProcesses
                        }
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
