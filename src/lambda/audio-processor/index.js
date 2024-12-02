const RedisManager = require('./utils/RedisManager');
const TaskManager = require('./utils/TaskManager');
const AudioProcessor = require('./utils/AudioProcessor');
const FileManager = require('./utils/FileManager');
const PydubManager = require('./utils/PydubManager');
const S3Manager = require('./utils/S3Manager');
const { TaskError } = require('./utils/errors');

// Initialize managers
const redis = new RedisManager();
const fileManager = new FileManager(process.env.TEMP_DIR || '/tmp/audio-processing');
const pydub = new PydubManager();
const s3 = new S3Manager(process.env.AWS_BUCKET_NAME);
const processor = new AudioProcessor(fileManager, pydub);
const taskManager = new TaskManager(redis, processor, s3);

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = 0;

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        // Initialize file system and pydub
        await fileManager.initialize();
        await pydub.initialize();

        // Run periodic cleanup of stuck tasks
        const now = Date.now();
        if (now - lastCleanup > CLEANUP_INTERVAL) {
            await redis.cleanupStuckTasks();
            lastCleanup = now;
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

        // Check queue status
        const queueLength = await redis.getQueueLength();
        const processingCount = await redis.getProcessingCount();
        const maxConcurrent = 2;

        // Initialize task
        const initResult = await taskManager.initializeTask(event);
        
        // If task is already completed, return the result
        if (initResult.type === 'completed') {
            return {
                statusCode: 200,
                body: initResult.result
            };
        }

        // If task is already being processed, return conflict
        if (initResult.type === 'conflict') {
            return {
                statusCode: 409,
                body: {
                    message: 'Task is already being processed',
                    taskId: initResult.taskId,
                    status: initResult.status,
                    progress: initResult.progress
                }
            };
        }

        // If we're at capacity, queue the task
        if (processingCount >= maxConcurrent) {
            return {
                statusCode: 202,
                body: {
                    message: 'Task queued successfully',
                    taskId: initResult.taskId,
                    queuePosition: queueLength,
                    activeProcesses: processingCount
                }
            };
        }

        // Try to get a task from the queue
        let taskToProcess = await redis.dequeueTask();

        // If no task in queue and we have capacity, process the incoming task
        if (!taskToProcess) {
            console.log('No queued tasks, processing incoming task');
            return await taskManager.processTask(event);
        }

        // Process the dequeued task
        console.log('Processing dequeued task:', {
            taskId: taskToProcess.id,
            segmentCount: taskToProcess.segments?.length || 0,
            queueLength,
            processingCount
        });
        
        const result = await taskManager.processTask({
            ...event,
            segments: taskToProcess.segments,
            conversationId: taskToProcess.conversationId
        });

        return result;

    } catch (error) {
        console.error('Error in Lambda handler:', error);

        // Get detailed error information
        const errorDetails = {
            message: error.message,
            name: error.name,
            phase: error.phase,
            details: error.details || {},
            stack: error.stack,
            timestamp: new Date().toISOString(),
            taskId: error.details?.taskId,
            conversationId: error.details?.conversationId,
            processingTime: error.details?.processingTime,
            progress: error.details?.progress
        };

        // Log detailed error information
        console.error('Detailed error information:', JSON.stringify(errorDetails, null, 2));

        // Determine if error is retryable
        const isRetryable = error instanceof TaskError && error.details?.retryable;
        
        return {
            statusCode: isRetryable ? 503 : 500,
            body: {
                error: 'Failed to process audio',
                details: errorDetails,
                retryable: isRetryable
            }
        };
    } finally {
        try {
            // Cleanup temporary files
            await fileManager.cleanup();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
};

// Handle Lambda container shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, cleaning up...');
    try {
        await fileManager.cleanup();
    } catch (error) {
        console.error('Error during shutdown cleanup:', error);
    }
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
