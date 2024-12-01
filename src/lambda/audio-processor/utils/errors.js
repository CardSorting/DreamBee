class ProcessingError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ProcessingError';
        this.details = details;
    }
}

class FileSystemError extends ProcessingError {
    constructor(message, details = null) {
        super(message, details);
        this.name = 'FileSystemError';
    }
}

class NetworkError extends ProcessingError {
    constructor(message, details = null) {
        super(message, details);
        this.name = 'NetworkError';
    }
}

class AudioProcessingError extends ProcessingError {
    constructor(message, details = null) {
        super(message, details);
        this.name = 'AudioProcessingError';
    }
}

class S3Error extends ProcessingError {
    constructor(message, details = null) {
        super(message, details);
        this.name = 'S3Error';
    }
}

module.exports = {
    ProcessingError,
    FileSystemError,
    NetworkError,
    AudioProcessingError,
    S3Error
};
