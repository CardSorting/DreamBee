require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs').promises;
const os = require('os');

// FFmpeg path in Lambda layer
const FFMPEG_PATH = '/opt/ffmpeg/bin/ffmpeg';

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(outputPath);
        reject(err);
      });
    }).on('error', reject);
  });
}

async function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, args);
    const chunks = [];
    let errorOutput = '';

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

async function processAudioSegment(segment, index, tempDir) {
  const inputPath = path.join(tempDir, `input_${index}.mp3`);
  const outputPath = path.join(tempDir, `segment_${index}.wav`);

  // Download the audio file
  await downloadFile(segment.url, inputPath);

  // Trim the audio segment
  const args = [
    '-i', inputPath,
    '-ss', segment.startTime.toString(),
    '-to', segment.endTime.toString(),
    '-acodec', 'pcm_s16le',
    '-ar', '44100',
    '-ac', '2',
    outputPath
  ];

  await runFFmpeg(args);
  return outputPath;
}

async function mergeAudioFiles(segmentFiles, outputPath) {
  // Create a file list for FFmpeg
  const listPath = path.join(path.dirname(segmentFiles[0]), 'files.txt');
  const fileList = segmentFiles.map(file => `file '${file}'`).join('\n');
  await fs.writeFile(listPath, fileList);

  // Merge all segments
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath
  ];

  await runFFmpeg(args);
  const finalAudio = await fs.readFile(outputPath);
  return finalAudio;
}

exports.handler = async (event) => {
  const tempDir = path.join(os.tmpdir(), 'audio-processing');
  
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const { segments } = event;
    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid segments data');
    }

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Process each segment
    const segmentPromises = segments.map((segment, index) => 
      processAudioSegment(segment, index, tempDir)
    );
    const processedSegments = await Promise.all(segmentPromises);

    // Merge all segments
    const outputPath = path.join(tempDir, 'final_output.wav');
    const mergedAudio = await mergeAudioFiles(processedSegments, outputPath);

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      statusCode: 200,
      body: {
        audioData: mergedAudio.toString('base64'),
        format: 'wav'
      }
    };
  } catch (error) {
    console.error('Error:', error);
    // Clean up on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    return {
      statusCode: 500,
      body: {
        error: error.message || 'Internal server error'
      }
    };
  }
};
