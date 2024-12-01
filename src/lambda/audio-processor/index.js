require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');

const FFmpegManager = require('./utils/FFmpegManager');
const FileManager = require('./utils/FileManager');
const S3Manager = require('./utils/S3Manager');
const AudioProcessor = require('./utils/AudioProcessor');
const RedisManager = require('./utils/RedisManager');
const TaskManager = require('./utils/TaskManager');
const { ProcessingError } = require('./utils/errors');

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// Constants
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
const S3_BUCKET = process.env.AWS_BUCKET_NAME;

class ProcessingManager {
    constructor(event) {
        this.event = event;
        this.tempDir = path.join(os.tmpdir(), 'audio-processing');
        this.fileManager = null;
        this.s3 = null;
        this.processor = null;
        this.redis = null;
        this.taskManager = null;
    }

    async initialize() {
        try {
            console.log('Initializing processing manager');
            
            // Initialize managers
            this.fileManager = new FileManager(this.tempDir);
            await this.fileManager.initialize();

            const ffmpeg = new FFmpegManager();
            await ffmpeg.initialize();

            this.s3 = new S3Manager(S3_BUCKET);
            this.processor = new AudioProcessor(this.fileManager, ffmpeg);
            this.redis = new RedisManager();
            this.taskManager = new TaskManager(this.redis, this.processor);
            
            console.log('Initialization complete');
        } catch (error) {
            console.error('Initialization failed:', error);
            throw new ProcessingError('Failed to initialize processing manager', { cause: error });
        }
    }

    async cleanup() {
        console.log('Starting cleanup process');
        
        try {
            // Clean up resources
            if (this.fileManager) {
                await this.fileManager.cleanup();
                console.log('File cleanup completed');
            }

            // Clean up task
            if (this.taskManager) {
                await this.taskManager.cleanup();
                console.log('Task cleanup completed');
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async process() {
        try {
            console.log('Starting processing with event:', JSON.stringify(this.event, null, 2));

            // Initialize managers
            await this.initialize();

            // Process through task manager
            const result = await this.taskManager.processTask(this.event);
            
            // Ensure response is properly formatted
            return this.formatResponse(result);

        } catch (error) {
            console.error('Error in Lambda handler:', error);
            return this.formatError(error);
        } finally {
            await this.cleanup();
        }
    }

    formatResponse(result) {
        try {
            // Ensure result has proper structure
            if (!result || typeof result !== 'object') {
                throw new Error('Invalid result format');
            }

            // Ensure statusCode is present and valid
            if (!result.statusCode || typeof result.statusCode !== 'number') {
                result = {
                    statusCode: 200,
                    body: result
                };
            }

            // Ensure body is properly serialized
            if (result.body && typeof result.body === 'object') {
                result.body = JSON.stringify(result.body);
            }

            return result;
        } catch (error) {
            console.error('Error formatting response:', error);
            return this.formatError(error);
        }
    }

    formatError(error) {
        const errorResponse = {
            statusCode: error.statusCode || 500,
            body: JSON.stringify({
                error: error instanceof ProcessingError ? error.message : 'Internal server error',
                details: error instanceof ProcessingError ? error.details : error.message,
                taskId: this.taskManager?.currentTask?.id,
                timestamp: new Date().toISOString()
            })
        };

        return errorResponse;
    }
}

exports.handler = async (event) => {
    try {
        // Handle test events
        if (event.test) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Test successful',
                    environment: {
                        redis: {
                            url: process.env.REDIS_URL ? 'configured' : 'missing',
                            token: process.env.REDIS_TOKEN ? 'configured' : 'missing'
                        },
                        ffmpeg: process.env.FFMPEG_TIMEOUT ? 'configured' : 'missing',
                        temp: process.env.TEMP_DIR ? 'configured' : 'missing',
                        memory: process.env.NODE_OPTIONS ? 'configured' : 'missing'
                    },
                    timestamp: new Date().toISOString()
                })
            };
        }

        const manager = new ProcessingManager(event);
        return await manager.process();
    } catch (error) {
        console.error('Unhandled error in Lambda handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Unhandled error in Lambda handler',
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            })
        };
    }
};
