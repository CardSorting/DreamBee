const fs = require('fs');
const { Readable, Transform } = require('stream');
const { promisify } = require('util');
const { AudioProcessingError } = require('./errors');

const pipeline = promisify(require('stream').pipeline);

class StreamingMerger {
    constructor(fileManager, ffmpegManager) {
        this.fileManager = fileManager;
        this.ffmpeg = ffmpegManager;
        // Increased chunk size for better performance with large files
        this.chunkSize = 5 * 1024 * 1024; // 5MB chunks
        this.maxBufferSize = 50 * 1024 * 1024; // 50MB buffer
        this.LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
    }

    createReadStream(filePath) {
        return fs.createReadStream(filePath, {
            highWaterMark: this.chunkSize
        });
    }

    createWriteStream(filePath) {
        return fs.createWriteStream(filePath, {
            highWaterMark: this.chunkSize
        });
    }

    createBufferTransform(maxSize = this.maxBufferSize) {
        let buffer = Buffer.alloc(0);
        let totalProcessed = 0;
        
        return new Transform({
            transform(chunk, encoding, callback) {
                totalProcessed += chunk.length;
                
                // Check if we're approaching memory limits
                if (buffer.length + chunk.length > maxSize) {
                    // Flush buffer immediately if we're approaching limits
                    if (buffer.length > 0) {
                        this.push(buffer);
                        buffer = Buffer.alloc(0);
                    }
                    // Push chunk directly if it's too large for buffer
                    this.push(chunk);
                } else {
                    buffer = Buffer.concat([buffer, chunk]);
                    
                    // Process in optimal chunk sizes
                    while (buffer.length >= this.chunkSize) {
                        this.push(buffer.slice(0, this.chunkSize));
                        buffer = buffer.slice(this.chunkSize);
                    }
                }
                
                callback();
            },
            
            flush(callback) {
                if (buffer.length > 0) {
                    this.push(buffer);
                }
                callback();
            }
        });
    }

    async streamMerge(inputPaths, outputPath) {
        const streams = inputPaths.map(path => this.createReadStream(path));
        const outputStream = this.createWriteStream(outputPath);
        const totalSize = await this.getTotalSize(inputPaths);
        const bufferTransform = this.createBufferTransform();
        const progressTracker = this.createProgressTracker(totalSize);

        try {
            await pipeline(
                Readable.from(this.concatenateStreams(streams)),
                bufferTransform,
                progressTracker,
                outputStream
            );
        } catch (error) {
            throw new AudioProcessingError('Stream merge failed', { cause: error });
        }
    }

    async *concatenateStreams(streams) {
        const silenceBuffer = Buffer.alloc(4410); // 0.1s of silence at 44.1kHz
        
        for (const stream of streams) {
            try {
                for await (const chunk of stream) {
                    yield chunk;
                }
                yield silenceBuffer;
            } catch (error) {
                console.error('Error in stream concatenation:', error);
                throw new AudioProcessingError('Stream concatenation failed', { cause: error });
            } finally {
                // Ensure streams are properly closed
                if (stream.destroy) {
                    stream.destroy();
                }
            }
        }
    }

    async mergeInChunks(files, chunkSize = 5) {
        const chunks = [];
        const totalFiles = files.length;
        
        // Split files into chunks
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            const chunkOutput = this.fileManager.getPath(`chunk_${i}.wav`);
            
            console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(totalFiles / chunkSize)}`);
            
            await this.streamMerge(chunk, chunkOutput);
            chunks.push(chunkOutput);

            // Clean up original files in this chunk
            for (const file of chunk) {
                await this.fileManager.deleteFile(file);
            }

            // Force garbage collection for large operations
            if (global.gc) {
                global.gc();
            }
        }

        return chunks;
    }

    async mergeFinal(chunks, outputPath) {
        console.log('Starting final merge process');
        
        try {
            // Create a temporary directory for standardized audio files
            const standardizedChunks = [];
            
            // First, standardize all chunks to the same format
            for (let i = 0; i < chunks.length; i++) {
                const standardizedPath = this.fileManager.getPath(`standardized_${i}.wav`);
                
                // Standardize audio format (PCM 16-bit, 44.1kHz, stereo)
                const standardizeArgs = [
                    '-i', chunks[i],
                    '-acodec', 'pcm_s16le',
                    '-ar', '44100',
                    '-ac', '2',
                    '-y',
                    standardizedPath
                ];
                
                await this.ffmpeg.runCommand(standardizeArgs);
                standardizedChunks.push(standardizedPath);
                
                // Clean up original chunk
                await this.fileManager.deleteFile(chunks[i]);
            }
            
            // Create a temporary file for the concat list
            const listPath = this.fileManager.getPath('final_list.txt');
            const fileList = standardizedChunks.map(file => `file '${file}'`).join('\n');
            await this.fileManager.writeFile(listPath, fileList);

            // Use FFmpeg's concat demuxer with standardized files
            const args = [
                '-f', 'concat',
                '-safe', '0',
                '-i', listPath,
                '-c:a', 'pcm_s16le',  // Maintain PCM format
                '-ar', '44100',       // Maintain sample rate
                '-ac', '2',           // Maintain channels
                '-y',
                outputPath
            ];

            await this.ffmpeg.runCommand(args);

            // Clean up temporary files
            await this.fileManager.deleteFile(listPath);
            for (const chunk of standardizedChunks) {
                await this.fileManager.deleteFile(chunk);
            }
            
            console.log('Final merge completed successfully');
        } catch (error) {
            console.error('Error in final merge:', error);
            throw new AudioProcessingError('Final merge failed', { cause: error });
        }
    }

    createProgressTracker(totalSize) {
        let processedSize = 0;
        let lastLogTime = Date.now();
        const logInterval = 1000; // Log every second
        
        return new Transform({
            transform(chunk, encoding, callback) {
                processedSize += chunk.length;
                const currentTime = Date.now();
                
                // Log progress at intervals
                if (currentTime - lastLogTime >= logInterval) {
                    const progress = Math.round((processedSize / totalSize) * 100);
                    const speed = (processedSize / (1024 * 1024)) / ((currentTime - lastLogTime) / 1000);
                    console.log(`Merge progress: ${progress}% (${speed.toFixed(2)} MB/s)`);
                    lastLogTime = currentTime;
                }
                
                this.push(chunk);
                callback();
            }
        });
    }

    async getTotalSize(files) {
        let total = 0;
        for (const file of files) {
            const stats = await this.fileManager.verifyFile(file);
            total += stats.size;
        }
        return total;
    }

    async streamingMerge(files, outputPath) {
        try {
            console.log('Starting streaming merge process');
            const totalSize = await this.getTotalSize(files);
            
            // Adjust chunk size based on total size
            const chunkSize = totalSize > this.LARGE_FILE_THRESHOLD ? 3 : 5;
            console.log(`Using chunk size of ${chunkSize} for ${(totalSize / (1024 * 1024)).toFixed(2)}MB total`);
            
            // First level: merge files in small chunks
            const chunks = await this.mergeInChunks(files, chunkSize);
            console.log(`Created ${chunks.length} intermediate chunks`);

            // Second level: merge chunks into final output
            await this.mergeFinal(chunks, outputPath);
            console.log('Completed final merge');

            // Verify final output
            await this.fileManager.verifyFile(outputPath);
            
            return outputPath;
        } catch (error) {
            console.error('Streaming merge failed:', error);
            throw new AudioProcessingError('Streaming merge failed', { cause: error });
        }
    }

    async compressStream(inputPath, outputPath) {
        const inputStream = this.createReadStream(inputPath);
        const args = [
            '-i', 'pipe:0',
            '-codec:a', 'libmp3lame',
            '-q:a', '2',
            '-f', 'mp3',
            'pipe:1'
        ];

        const ffmpegProcess = this.ffmpeg.createProcess(args);
        const outputStream = this.createWriteStream(outputPath);
        const totalSize = await this.getTotalSize([inputPath]);
        const progressTracker = this.createProgressTracker(totalSize);

        try {
            // Use separate pipelines for input and output to prevent backpressure issues
            await Promise.all([
                pipeline(inputStream, ffmpegProcess.stdin),
                pipeline(ffmpegProcess.stdout, progressTracker, outputStream)
            ]);

        } catch (error) {
            throw new AudioProcessingError('Compression stream failed', { cause: error });
        }
    }
}

module.exports = StreamingMerger;
