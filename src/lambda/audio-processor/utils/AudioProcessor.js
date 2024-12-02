const path = require('path');
const { AudioProcessingError } = require('./errors');
const AudioMerger = require('./AudioMerger');
const StreamingMerger = require('./StreamingMerger');
const PydubManager = require('./PydubManager');

class AudioProcessor {
    constructor(fileManager) {
        this.fileManager = fileManager;
        this.pydub = new PydubManager();
        this.merger = new AudioMerger(fileManager, this.pydub);
        this.streamingMerger = new StreamingMerger(fileManager, this.pydub);
        this.LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
        this.onProgress = null;
        this.resetState();
    }

    resetState() {
        this.totalSegments = 0;
        this.processedSegments = 0;
        this.totalSize = 0;
        this.processedSize = 0;
        this.errors = [];
        this.retries = 0;
        this.startTime = Date.now();
    }

    updateProgress(phase, details = '', mergeProgress = null) {
        const progress = {
            currentPhase: phase,
            details: details,
            mergeProgress: mergeProgress !== null ? mergeProgress : undefined,
            processedSegments: this.processedSegments,
            totalSegments: this.totalSegments,
            processedSize: this.processedSize,
            totalSize: this.totalSize,
            errors: this.errors,
            retries: this.retries,
            elapsedTime: Date.now() - this.startTime
        };

        console.log(`Progress: ${phase} - ${details}${mergeProgress ? ` (${mergeProgress}%)` : ''}`);
        
        if (this.onProgress) {
            try {
                this.onProgress(progress).catch(error => {
                    console.error('Error in progress callback:', error);
                });
            } catch (error) {
                console.error('Error in progress callback:', error);
            }
        }
    }

    async processSegmentWithRetry(segment, index, maxRetries = 3) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.updateProgress('processing', `Segment ${index + 1}/${this.totalSegments} (Attempt ${attempt}/${maxRetries})`);
                return await this.processSegment(segment, index);
            } catch (error) {
                lastError = error;
                console.error(`Error processing segment ${index} (Attempt ${attempt}/${maxRetries}):`, error);
                
                // Enhanced error logging
                const errorDetails = {
                    segment: index,
                    attempt,
                    error: error.message,
                    timestamp: Date.now(),
                    details: error.details || {},
                    url: segment.url ? segment.url.substring(0, segment.url.indexOf('?')) : 'unknown',
                    phase: error.phase || 'unknown',
                    cause: error.cause ? {
                        name: error.cause.name,
                        message: error.cause.message,
                        code: error.cause.code
                    } : {}
                };
                
                console.log('Detailed error information:', errorDetails);
                this.errors.push(errorDetails);
                this.retries++;
                
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw new AudioProcessingError(`Failed to process segment ${index} after ${maxRetries} attempts`, {
            segmentIndex: index,
            lastError,
            attempts: maxRetries,
            errors: this.errors.filter(e => e.segment === index)
        });
    }

    async processSegment(segment, index) {
        const inputPath = this.fileManager.getPath(`input_${index}.mp3`);
        const normalizedPath = this.fileManager.getPath(`normalized_${index}.wav`);
        const outputPath = this.fileManager.getPath(`segment_${index}.wav`);

        try {
            console.log(`Processing segment ${index}:`, {
                url: segment.url ? segment.url.substring(0, segment.url.indexOf('?')) : 'unknown',
                startTime: segment.startTime,
                endTime: segment.endTime,
                character: segment.character
            });

            // Download with detailed error handling
            try {
                await Promise.race([
                    this.fileManager.downloadFile(segment.url, inputPath),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 30000))
                ]);
            } catch (error) {
                throw new AudioProcessingError('Failed to download segment', {
                    phase: 'download',
                    cause: error,
                    url: segment.url ? segment.url.substring(0, segment.url.indexOf('?')) : 'unknown'
                });
            }
            
            // Verify downloaded file
            try {
                const inputStats = await this.fileManager.verifyFile(inputPath);
                this.totalSize += inputStats.size;
                console.log(`Downloaded segment ${index}:`, {
                    size: inputStats.size,
                    path: inputPath
                });
            } catch (error) {
                throw new AudioProcessingError('Failed to verify downloaded file', {
                    phase: 'verify-download',
                    cause: error
                });
            }

            // Normalize audio
            try {
                await this.pydub.normalizeAudio(inputPath, normalizedPath);
                await this.fileManager.verifyFile(normalizedPath);
                await this.fileManager.deleteFile(inputPath);
                console.log(`Normalized segment ${index}`);
            } catch (error) {
                throw new AudioProcessingError('Failed to normalize audio', {
                    phase: 'normalize',
                    cause: error
                });
            }

            // Trim audio
            try {
                await this.pydub.trimAudio(normalizedPath, outputPath, segment.startTime, segment.endTime);
                const stats = await this.fileManager.verifyFile(outputPath);
                await this.fileManager.deleteFile(normalizedPath);
                
                this.processedSegments++;
                this.processedSize += stats.size;
                
                console.log(`Trimmed segment ${index}:`, {
                    size: stats.size,
                    startTime: segment.startTime,
                    endTime: segment.endTime
                });
                
                return {
                    path: outputPath,
                    size: stats.size
                };
            } catch (error) {
                throw new AudioProcessingError('Failed to trim audio', {
                    phase: 'trim',
                    cause: error,
                    timing: {
                        start: segment.startTime,
                        end: segment.endTime
                    }
                });
            }
        } catch (error) {
            // Clean up on error
            try {
                await this.fileManager.deleteFile(inputPath);
                await this.fileManager.deleteFile(normalizedPath);
                await this.fileManager.deleteFile(outputPath);
            } catch (cleanupError) {
                console.error('Error cleaning up files:', cleanupError);
            }

            throw error;
        }
    }

    async processBatch(segments, startIndex) {
        this.updateProgress('batch-processing', `Batch starting at ${startIndex}`);
        
        const results = [];
        for (let i = 0; i < segments.length; i++) {
            try {
                const result = await this.processSegmentWithRetry(segments[i], startIndex + i);
                results.push(result);
                
                if (global.gc) {
                    global.gc();
                }
            } catch (error) {
                console.error(`Fatal error processing segment ${startIndex + i}:`, error);
                for (const result of results) {
                    await this.fileManager.deleteFile(result.path);
                }
                throw error;
            }
        }
        
        return results;
    }

    async processSegmentsInBatches(segments) {
        const processedFiles = [];
        let totalSize = 0;

        try {
            const totalDuration = segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
            const batchSize = totalDuration > 300 ? 2 : (segments.length > 20 ? 3 : 5);
            console.log(`Using batch size of ${batchSize} for total duration ${totalDuration}s`);

            for (let i = 0; i < segments.length; i += batchSize) {
                const batch = segments.slice(i, i + batchSize);
                this.updateProgress('batch-start', `Batch ${Math.floor(i / batchSize) + 1}`);
                
                const batchResults = await this.processBatch(batch, i);
                
                for (const result of batchResults) {
                    totalSize += result.size;
                    processedFiles.push(result.path);
                }

                this.updateProgress('batch-complete', 
                    `${this.processedSegments}/${this.totalSegments} segments processed`,
                    Math.round((i + batch.length) / segments.length * 100)
                );

                if (global.gc) {
                    global.gc();
                }
            }

            return { processedFiles, totalSize };
        } catch (error) {
            for (const filePath of processedFiles) {
                await this.fileManager.deleteFile(filePath);
            }
            throw error;
        }
    }

    async mergeFiles(segments, processedFiles, totalSize) {
        this.updateProgress('merging', 'Starting merge process');

        try {
            this.updateProgress('merging', 'Using streaming merger');
            const outputPath = this.fileManager.getPath('merged_output.wav');
            await this.streamingMerger.streamingMerge(processedFiles, outputPath);
            
            const finalPath = this.fileManager.getPath('final_output.mp3');
            await this.pydub.compressAudio(outputPath, finalPath);
            
            await this.fileManager.deleteFile(outputPath);

            if (totalSize > this.LARGE_FILE_THRESHOLD) {
                return {
                    path: finalPath,
                    format: 'mp3',
                    size: totalSize,
                    isLarge: true
                };
            } else {
                const finalAudio = await this.fileManager.readFile(finalPath);
                await this.fileManager.deleteFile(finalPath);
                return {
                    data: finalAudio,
                    format: 'mp3'
                };
            }
        } catch (error) {
            console.error('Error in merge process:', error);
            throw new AudioProcessingError('Failed to merge audio files', { cause: error });
        }
    }

    async process(segments) {
        try {
            this.resetState();
            this.totalSegments = segments.length;

            await this.pydub.initialize();
            this.updateProgress('initializing', 'Starting audio processing');
            console.log('Processing segments:', segments.map(s => ({
                url: s.url ? s.url.substring(0, s.url.indexOf('?')) : 'unknown',
                startTime: s.startTime,
                endTime: s.endTime,
                character: s.character
            })));

            this.updateProgress('processing-segments', 'Starting segment processing');
            const { processedFiles, totalSize } = await this.processSegmentsInBatches(segments);

            const result = await this.mergeFiles(segments, processedFiles, totalSize);

            this.updateProgress('complete', 'Audio processing completed', 100);
            return result;

        } catch (error) {
            console.error('Error in audio processing:', error);
            throw new AudioProcessingError('Failed to process audio', { 
                progress: {
                    processedSegments: this.processedSegments,
                    totalSegments: this.totalSegments,
                    processedSize: this.processedSize,
                    totalSize: this.totalSize,
                    errors: this.errors,
                    retries: this.retries,
                    elapsedTime: Date.now() - this.startTime
                },
                cause: error 
            });
        }
    }
}

module.exports = AudioProcessor;
