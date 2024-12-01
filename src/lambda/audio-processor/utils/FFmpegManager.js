const { spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const { ProcessingError } = require('./errors');

const access = promisify(fs.access);

class FFmpegManager {
    static PATHS = [
        '/opt/ffmpeg/ffmpeg',
        '/opt/bin/ffmpeg',
        '/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg'
    ];

    // Default timeout of 5 minutes (300000ms)
    static DEFAULT_TIMEOUT = 300000;

    constructor() {
        this.ffmpegPath = null;
    }

    async initialize() {
        for (const path of FFmpegManager.PATHS) {
            try {
                await access(path);
                console.log(`Found FFmpeg at: ${path}`);
                this.ffmpegPath = path;
                return;
            } catch (error) {
                console.log(`FFmpeg not found at: ${path}`);
            }
        }
        throw new ProcessingError(
            'FFmpeg not found in any of the expected locations',
            { searchedPaths: FFmpegManager.PATHS }
        );
    }

    createProcess(args, timeout = FFmpegManager.DEFAULT_TIMEOUT) {
        if (!this.ffmpegPath) {
            throw new ProcessingError('FFmpeg not initialized');
        }

        console.log(`Creating FFmpeg process with args: ${args.join(' ')}`);
        const process = spawn(this.ffmpegPath, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Set up timeout handler
        const timeoutId = setTimeout(() => {
            console.error(`FFmpeg process timed out after ${timeout}ms`);
            if (process.exitCode === null) {
                process.kill('SIGTERM');
                throw new ProcessingError('FFmpeg process timed out');
            }
        }, timeout);

        // Clear timeout when process ends
        process.on('close', () => {
            clearTimeout(timeoutId);
        });

        // Handle process errors
        process.on('error', (err) => {
            clearTimeout(timeoutId);
            console.error('FFmpeg process error:', err);
            throw new ProcessingError('FFmpeg process error', { cause: err });
        });

        // Track progress through stderr
        let duration = 0;
        let progress = 0;
        process.stderr.on('data', (data) => {
            const message = data.toString();
            
            // Extract duration if not already found
            if (duration === 0) {
                const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
                if (durationMatch) {
                    const [, hours, minutes, seconds] = durationMatch;
                    duration = (parseInt(hours) * 3600) + (parseInt(minutes) * 60) + parseInt(seconds);
                }
            }

            // Extract current time and calculate progress
            const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch && duration > 0) {
                const [, hours, minutes, seconds] = timeMatch;
                const currentTime = (parseInt(hours) * 3600) + (parseInt(minutes) * 60) + parseInt(seconds);
                progress = Math.round((currentTime / duration) * 100);
                console.log(`FFmpeg progress: ${progress}%`);
            }

            // Log non-progress messages
            if (!message.includes('time=') && !message.includes('size=')) {
                console.error(`FFmpeg stderr: ${message}`);
            }
        });

        return process;
    }

    async runCommand(args, timeout = FFmpegManager.DEFAULT_TIMEOUT) {
        if (!this.ffmpegPath) {
            throw new ProcessingError('FFmpeg not initialized');
        }

        return new Promise((resolve, reject) => {
            console.log(`Running FFmpeg with args: ${args.join(' ')}`);
            
            const ffmpeg = this.createProcess(args, timeout);
            const chunks = [];
            let errorOutput = '';

            ffmpeg.stdout.on('data', (chunk) => {
                chunks.push(chunk);
            });

            ffmpeg.stderr.on('data', (data) => {
                const message = data.toString();
                errorOutput += message;
            });

            ffmpeg.on('close', (code) => {
                console.log(`FFmpeg process exited with code ${code}`);
                if (code === 0) {
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                } else {
                    reject(new ProcessingError(
                        `FFmpeg process failed with code ${code}`,
                        { code, errorOutput }
                    ));
                }
            });

            ffmpeg.on('error', (err) => {
                console.error(`FFmpeg process error: ${err}`);
                reject(new ProcessingError('FFmpeg process error', { cause: err }));
            });
        });
    }

    async generateSilence(duration, outputPath) {
        console.log(`Generating ${duration}s silence at ${outputPath}`);
        const args = [
            '-f', 'lavfi',
            '-i', `anullsrc=r=44100:cl=stereo`,
            '-t', duration.toString(),
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            '-y',
            outputPath
        ];
        await this.runCommand(args);
        return outputPath;
    }

    async normalizeAudio(inputPath, outputPath) {
        const args = [
            '-i', inputPath,
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            '-y',
            outputPath
        ];
        // Allow more time for normalization
        await this.runCommand(args, FFmpegManager.DEFAULT_TIMEOUT * 2);
    }

    async trimAudio(inputPath, outputPath, startTime, endTime) {
        const args = [
            '-i', inputPath,
            '-ss', startTime.toString(),
            '-to', endTime.toString(),
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            '-y',
            outputPath
        ];
        await this.runCommand(args);
    }

    async mergeAudio(listPath, outputPath) {
        const args = [
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            '-y',
            outputPath
        ];
        // Allow more time for merging
        await this.runCommand(args, FFmpegManager.DEFAULT_TIMEOUT * 3);
    }

    async compressAudio(inputPath, outputPath) {
        const args = [
            '-i', inputPath,
            '-codec:a', 'libmp3lame',
            '-q:a', '2',  // High quality VBR
            '-y',
            outputPath
        ];
        // Allow more time for compression
        await this.runCommand(args, FFmpegManager.DEFAULT_TIMEOUT * 2);
    }

    async streamCompress(inputStream, outputStream, options = {}) {
        const args = [
            '-i', 'pipe:0',
            '-codec:a', 'libmp3lame',
            '-q:a', options.quality || '2',
            '-f', 'mp3',
            'pipe:1'
        ];

        const process = this.createProcess(args, options.timeout || FFmpegManager.DEFAULT_TIMEOUT * 2);
        
        // Pipe input and output
        inputStream.pipe(process.stdin);
        process.stdout.pipe(outputStream);

        // Return a promise that resolves when the process completes
        return new Promise((resolve, reject) => {
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new ProcessingError(`FFmpeg process failed with code ${code}`));
                }
            });
        });
    }
}

module.exports = FFmpegManager;
