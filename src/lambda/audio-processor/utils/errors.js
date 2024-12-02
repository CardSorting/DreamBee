class BaseError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
        this.timestamp = Date.now();

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // Add phase information if available
        if (details.phase) {
            this.phase = details.phase;
        }

        // Add cause information
        if (details.cause) {
            this.cause = details.cause;
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            phase: this.phase,
            cause: this.cause ? {
                name: this.cause.name,
                message: this.cause.message,
                code: this.cause.code
            } : undefined
        };
    }
}

class FileSystemError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'filesystem',
            path: details.path,
            operation: details.operation
        });
    }
}

class NetworkError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'network',
            url: details.url,
            statusCode: details.statusCode
        });
    }
}

class AudioProcessingError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'audio-processing',
            segmentIndex: details.segmentIndex,
            phase: details.phase,
            timing: details.timing
        });
    }
}

class S3Error extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 's3',
            bucket: details.bucket,
            key: details.key,
            operation: details.operation
        });
    }
}

class ProcessingError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'processing',
            command: details.command,
            exitCode: details.exitCode,
            stderr: details.stderr
        });
    }
}

class ValidationError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'validation',
            field: details.field,
            value: details.value,
            constraint: details.constraint
        });
    }
}

class TaskError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'task',
            taskId: details.taskId,
            status: details.status,
            progress: details.progress
        });
    }
}

class FFmpegError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'ffmpeg',
            command: details.command,
            exitCode: details.exitCode,
            stderr: details.stderr,
            duration: details.duration
        });
    }
}

class RedisError extends BaseError {
    constructor(message, details = {}) {
        super(message, {
            ...details,
            type: 'redis',
            operation: details.operation,
            key: details.key
        });
    }
}

// Error type mapping for better error handling
const ErrorTypes = {
    FILESYSTEM: 'filesystem',
    NETWORK: 'network',
    AUDIO_PROCESSING: 'audio-processing',
    S3: 's3',
    PROCESSING: 'processing',
    VALIDATION: 'validation',
    TASK: 'task',
    FFMPEG: 'ffmpeg',
    REDIS: 'redis'
};

// Helper function to determine if an error is retryable
function isRetryableError(error) {
    if (error instanceof NetworkError) {
        return true; // Network errors are generally retryable
    }
    if (error instanceof S3Error) {
        return error.details.type !== 'NoSuchKey'; // Missing files are not retryable
    }
    if (error instanceof ProcessingError) {
        return error.details.exitCode !== 1; // Non-fatal process errors are retryable
    }
    if (error instanceof RedisError) {
        return true; // Redis connection errors are retryable
    }
    return false;
}

// Helper function to format error for logging
function formatError(error) {
    return {
        name: error.name,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
        phase: error.phase,
        stack: error.stack,
        cause: error.cause ? {
            name: error.cause.name,
            message: error.cause.message,
            code: error.cause.code
        } : undefined
    };
}

module.exports = {
    BaseError,
    FileSystemError,
    NetworkError,
    AudioProcessingError,
    S3Error,
    ProcessingError,
    ValidationError,
    TaskError,
    FFmpegError,
    RedisError,
    ErrorTypes,
    isRetryableError,
    formatError
};
