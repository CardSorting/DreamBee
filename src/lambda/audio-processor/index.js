require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { URL } = require('url');
const { promisify } = require('util');

// Promisify fs functions we need
const access = promisify(fs.access);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const rmdir = promisify(fs.rmdir);
const unlink = promisify(fs.unlink);

// FFmpeg paths to try in order
const FFMPEG_PATHS = [
    '/opt/ffmpeg/ffmpeg',
    '/opt/bin/ffmpeg',  // Lambda layer bin directory
    '/bin/ffmpeg',      // Lambda layer bin directory (alternative)
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg'
];

// Silence duration in seconds
const SILENCE_DURATION = 0.5;

class ProcessingError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ProcessingError';
        this.details = details;
    }
}

async function findFFmpegPath() {
    for (const ffmpegPath of FFMPEG_PATHS) {
        try {
            await access(ffmpegPath);
            console.log(`Found FFmpeg at: ${ffmpegPath}`);
            return ffmpegPath;
        } catch (error) {
            console.log(`FFmpeg not found at: ${ffmpegPath}`);
        }
    }
    throw new ProcessingError(
        'FFmpeg not found in any of the expected locations',
        { searchedPaths: FFMPEG_PATHS }
    );
}

async function downloadFile(urlString, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading file from ${urlString} to ${outputPath}`);
        
        const handleDownload = (downloadUrl) => {
            const parsedUrl = new URL(downloadUrl);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'User-Agent': 'AWS-Lambda-Function',
                    'Accept': '*/*'
                }
            };

            const request = https.get(options, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    console.log(`Following redirect to: ${response.headers.location}`);
                    handleDownload(response.headers.location);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new ProcessingError(
                        `Failed to download file: ${response.statusCode} - ${response.statusMessage}`,
                        { statusCode: response.statusCode, url: urlString }
                    ));
                    return;
                }

                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', async () => {
                    try {
                        const buffer = Buffer.concat(chunks);
                        await writeFile(outputPath, buffer);
                        console.log(`Successfully downloaded file to ${outputPath}`);
                        resolve();
                    } catch (err) {
                        console.error(`Error writing file: ${err}`);
                        reject(new ProcessingError('Error writing downloaded file', { cause: err }));
                    }
                });
            });

            request.on('error', (err) => {
                console.error(`Error downloading file: ${err}`);
                reject(new ProcessingError('Network error during download', { cause: err }));
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new ProcessingError('Download timeout', { url: urlString }));
            });
        };

        handleDownload(urlString);
    });
}

async function runFFmpeg(args, ffmpegPath) {
    return new Promise((resolve, reject) => {
        console.log(`Running FFmpeg with args: ${args.join(' ')}`);
        
        const ffmpeg = spawn(ffmpegPath, args);
        const chunks = [];
        let errorOutput = '';

        ffmpeg.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stderr.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            // Only log non-progress messages
            if (!message.includes('time=') && !message.includes('size=')) {
                console.error(`FFmpeg stderr: ${message}`);
            }
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

async function generateSilence(duration, outputPath, ffmpegPath) {
    console.log(`Generating ${duration}s silence at ${outputPath}`);
    const args = [
        '-f', 'lavfi',
        '-i', `anullsrc=r=44100:cl=stereo`,
        '-t', duration.toString(),
        '-acodec', 'pcm_s16le',
        '-y',
        outputPath
    ];
    await runFFmpeg(args, ffmpegPath);
    return outputPath;
}

async function processAudioSegment(segment, index, tempDir, ffmpegPath) {
    console.log(`Processing segment ${index} of type ${typeof index}:`, segment);
    
    const inputPath = path.join(tempDir, `input_${index}.mp3`);
    const outputPath = path.join(tempDir, `segment_${index}.wav`);

    try {
        // Download the audio file
        await downloadFile(segment.url, inputPath);

        // Verify the file exists and has content
        const stats = await stat(inputPath);
        console.log(`Downloaded file size for segment ${index}: ${stats.size} bytes`);
        if (stats.size === 0) {
            throw new ProcessingError('Downloaded file is empty', { path: inputPath });
        }

        // Trim the audio segment
        const args = [
            '-i', inputPath,
            '-ss', segment.startTime.toString(),
            '-to', segment.endTime.toString(),
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            '-y',  // Overwrite output file if it exists
            outputPath
        ];

        await runFFmpeg(args, ffmpegPath);

        // Verify output file
        const outStats = await stat(outputPath);
        console.log(`Processed file size for segment ${index}: ${outStats.size} bytes`);
        if (outStats.size === 0) {
            throw new ProcessingError('Processed file is empty', { path: outputPath });
        }

        return outputPath;
    } catch (error) {
        console.error(`Error processing segment ${index}:`, error);
        throw new ProcessingError(
            `Failed to process segment ${index}`,
            { segmentIndex: index, cause: error }
        );
    }
}

async function mergeAudioFiles(segmentFiles, outputPath, ffmpegPath) {
    console.log('Merging audio files:', segmentFiles);
    
    try {
        // Generate silence file
        const silencePath = path.join(path.dirname(segmentFiles[0]), 'silence.wav');
        await generateSilence(SILENCE_DURATION, silencePath, ffmpegPath);

        // Create a file list for FFmpeg with silence between segments
        const listPath = path.join(path.dirname(segmentFiles[0]), 'files.txt');
        const fileList = segmentFiles.map((file, index) => {
            if (index === 0) {
                return `file '${file}'`;
            }
            return `file '${silencePath}'\nfile '${file}'`;
        }).join('\n');
        
        await writeFile(listPath, fileList);
        console.log('Created concat file list:', fileList);

        // Merge all segments
        const args = [
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            '-y',  // Overwrite output file if it exists
            outputPath
        ];

        await runFFmpeg(args, ffmpegPath);
        console.log('FFmpeg merge completed');

        const finalAudio = await readFile(outputPath);
        console.log(`Final audio size: ${finalAudio.length} bytes`);
        if (finalAudio.length === 0) {
            throw new ProcessingError('Merged audio file is empty');
        }
        return finalAudio;
    } catch (error) {
        console.error('Error merging audio files:', error);
        throw new ProcessingError('Failed to merge audio files', { cause: error });
    }
}

async function recursiveRmdir(dir) {
    const files = await new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) reject(err);
            else resolve(files);
        });
    });

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await stat(filePath);
        if (stats.isDirectory()) {
            await recursiveRmdir(filePath);
        } else {
            await unlink(filePath);
        }
    }

    await rmdir(dir);
}

exports.handler = async (event) => {
    const tempDir = path.join(os.tmpdir(), 'audio-processing');
    console.log('Starting audio processing in directory:', tempDir);
    
    try {
        console.log('Received event:', JSON.stringify(event, null, 2));

        const { segments } = event;
        if (!segments || !Array.isArray(segments)) {
            throw new ProcessingError('Invalid segments data');
        }

        // Find FFmpeg path
        const ffmpegPath = await findFFmpegPath();
        console.log(`Using FFmpeg path: ${ffmpegPath}`);

        // Create temp directory
        await mkdir(tempDir, { recursive: true });
        console.log('Created temp directory');

        // Process each segment
        console.log(`Processing ${segments.length} segments`);
        const segmentPromises = segments.map((segment, index) => {
            console.log(`Creating promise for segment ${index}`);
            return processAudioSegment(segment, index, tempDir, ffmpegPath);
        });
        
        console.log(`Created ${segmentPromises.length} segment promises`);
        const processedSegments = await Promise.all(segmentPromises);
        console.log('All segments processed:', processedSegments);

        // Merge all segments
        const outputPath = path.join(tempDir, 'final_output.wav');
        const mergedAudio = await mergeAudioFiles(processedSegments, outputPath, ffmpegPath);
        console.log('Audio merge completed');

        // Clean up
        await recursiveRmdir(tempDir);
        console.log('Cleanup completed');

        return {
            statusCode: 200,
            body: {
                audioData: mergedAudio.toString('base64'),
                format: 'wav'
            }
        };
    } catch (error) {
        console.error('Error in Lambda handler:', error);
        // Clean up on error
        try {
            await recursiveRmdir(tempDir);
            console.log('Error cleanup completed');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

        // Format the error response
        const errorResponse = {
            statusCode: 500,
            body: {
                error: error instanceof ProcessingError ? error.message : 'Internal server error',
                details: error instanceof ProcessingError ? error.details : error.message
            }
        };

        // Re-throw as a proper error to ensure AWS Lambda marks it as a failure
        throw errorResponse;
    }
};
