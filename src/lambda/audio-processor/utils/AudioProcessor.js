const path = require('path');
const { AudioProcessingError } = require('./errors');
const AudioMerger = require('./AudioMerger');
const StreamingMerger = require('./StreamingMerger');

class AudioProcessor {
    constructor(fileManager, ffmpegManager) {
        this.fileManager = fileManager;
        this.ffmpeg = ffmpegManager;
        this.merger = new AudioMerger(fileManager, ffmpegManager);
        this.streamingMerger = new StreamingMerger(fileManager, ffmpegManager);
        this.LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
        this.onProgress = null; // Progress callback function
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
                this.errors.push({
                    segment: index,
                    attempt,
                    error: error.message,
                    timestamp: Date.now()
                });
                this.retries++;
                
                // Wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    async processSegment(segment, index) {
        const inputPath = this.fileManager.getPath(`input_${index}.mp3`);
        const normalizedPath = this.fileManager.getPath(`normalized_${index}.wav`);
        const outputPath = this.fileManager.getPath(`segment_${index}.wav`);

        try {
            // Download and verify with timeout
            await Promise.race([
                this.fileManager.downloadFile(segment.url, inputPath),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 30000))
            ]);
            
            const inputStats = await this.fileManager.verifyFile(inputPath);
            this.totalSize += inputStats.size;

            // Normalize audio
            await this.ffmpeg.normalizeAudio(inputPath, normalizedPath);
            await this.fileManager.verifyFile(normalizedPath);
            await this.fileManager.deleteFile(inputPath); // Clean up early

            // Trim to segment bounds
            await this.ffmpeg.trimAudio(normalizedPath, outputPath, segment.startTime, segment.endTime);
            const stats = await this.fileManager.verifyFile(outputPath);
            await this.fileManager.deleteFile(normalizedPath); // Clean up early
            
            this.processedSegments++;
            this.processedSize += stats.size;
            
            return {
                path: outputPath,
                size: stats.size
            };
        } catch (error) {
            // Clean up on error
            try {
                await this.fileManager.deleteFile(inputPath);
                await this.fileManager.deleteFile(normalizedPath);
                await this.fileManager.deleteFile(outputPath);
            } catch (cleanupError) {
                console.error('Error cleaning up files:', cleanupError);
            }

            throw new AudioProcessingError(
                `Failed to process segment ${index}`,
                { segmentIndex: index, cause: error }
            );
        }
    }

    async processBatch(segments, startIndex) {
        this.updateProgress('batch-processing', `Batch starting at ${startIndex}`);
        
        // Process segments with retry mechanism
        const results = [];
        for (let i = 0; i < segments.length; i++) {
            try {
                const result = await this.processSegmentWithRetry(segments[i], startIndex + i);
                results.push(result);
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            } catch (error) {
                console.error(`Fatal error processing segment ${startIndex + i}:`, error);
                // Clean up any processed files before throwing
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
            // Determine batch size based on segment count and total duration
            const totalDuration = segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
            const batchSize = totalDuration > 300 ? 2 : (segments.length > 20 ? 3 : 5);
            console.log(`Using batch size of ${batchSize} for total duration ${totalDuration}s`);

            for (let i = 0; i < segments.length; i += batchSize) {
                const batch = segments.slice(i, i + batchSize);
                this.updateProgress('batch-start', `Batch ${Math.floor(i / batchSize) + 1}`);
                
                const batchResults = await this.processBatch(batch, i);
                
                // Track total size and collect file paths
                for (const result of batchResults) {
                    totalSize += result.size;
                    processedFiles.push(result.path);
                }

                this.updateProgress('batch-complete', 
                    `${this.processedSegments}/${this.totalSegments} segments processed`,
                    Math.round((i + batch.length) / segments.length * 100)
                );

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }

            return { processedFiles, totalSize };
        } catch (error) {
            // Clean up any processed files on error
            for (const filePath of processedFiles) {
                await this.fileManager.deleteFile(filePath);
            }
            throw error;
        }
    }

    async mergeFiles(segments, processedFiles, totalSize) {
        this.updateProgress('merging', 'Starting merge process');

        try {
            // Always use streaming merger for consistency and better memory handling
            this.updateProgress('merging', 'Using streaming merger');
            const outputPath = this.fileManager.getPath('merged_output.wav');
            await this.streamingMerger.streamingMerge(processedFiles, outputPath);
            
            // Compress using streaming
            const finalPath = this.fileManager.getPath('final_output.mp3');
            await this.streamingMerger.compressStream(outputPath, finalPath);
            
            // Clean up intermediate file
            await this.fileManager.deleteFile(outputPath);

            // For large files, return path instead of loading into memory
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
            // Reset state
            this.resetState();
            this.totalSegments = segments.length;

            this.updateProgress('initializing', 'Starting audio processing');

            // Process all segments in batches
            this.updateProgress('processing-segments', 'Starting segment processing');
            const { processedFiles, totalSize } = await this.processSegmentsInBatches(segments);

            // Merge all processed files
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
