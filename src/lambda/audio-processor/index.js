require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs').promises;
const os = require('os');

// FFmpeg path in Lambda layer
const FFMPEG_PATH = '/opt/ffmpeg/ffmpeg';

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading file from ${url} to ${outputPath}`);
    
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects for pre-signed URLs
        console.log(`Following redirect to: ${response.headers.location}`);
        downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded file to ${outputPath}`);
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(outputPath).catch(console.error);
        console.error(`Error writing file: ${err}`);
        reject(err);
      });
    });

    request.on('error', (err) => {
      console.error(`Error downloading file: ${err}`);
      reject(err);
    });

    // Set timeout
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`Running FFmpeg with args: ${args.join(' ')}`);
    
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
      console.log(`FFmpeg process exited with code ${code}`);
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error(`FFmpeg process error: ${err}`);
      reject(err);
    });
  });
}

async function processAudioSegment(segment, index, tempDir) {
  console.log(`Processing segment ${index}:`, segment);
  
  const inputPath = path.join(tempDir, `input_${index}.mp3`);
  const outputPath = path.join(tempDir, `segment_${index}.wav`);

  try {
    // Download the audio file
    await downloadFile(segment.url, inputPath);

    // Verify the file exists and has content
    const stats = await fs.stat(inputPath);
    console.log(`Downloaded file size: ${stats.size} bytes`);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

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

    // Verify output file
    const outStats = await fs.stat(outputPath);
    console.log(`Processed file size: ${outStats.size} bytes`);
    if (outStats.size === 0) {
      throw new Error('Processed file is empty');
    }

    return outputPath;
  } catch (error) {
    console.error(`Error processing segment ${index}:`, error);
    throw error;
  }
}

async function mergeAudioFiles(segmentFiles, outputPath) {
  console.log('Merging audio files:', segmentFiles);
  
  try {
    // Create a file list for FFmpeg
    const listPath = path.join(path.dirname(segmentFiles[0]), 'files.txt');
    const fileList = segmentFiles.map(file => `file '${file}'`).join('\n');
    await fs.writeFile(listPath, fileList);
    console.log('Created concat file list:', fileList);

    // Merge all segments
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath
    ];

    await runFFmpeg(args);
    console.log('FFmpeg merge completed');

    const finalAudio = await fs.readFile(outputPath);
    console.log(`Final audio size: ${finalAudio.length} bytes`);
    return finalAudio;
  } catch (error) {
    console.error('Error merging audio files:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  const tempDir = path.join(os.tmpdir(), 'audio-processing');
  console.log('Starting audio processing in directory:', tempDir);
  
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const { segments } = event;
    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid segments data');
    }

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    console.log('Created temp directory');

    // Process each segment
    console.log(`Processing ${segments.length} segments`);
    const segmentPromises = segments.map((segment, index) => 
      processAudioSegment(segment, index, tempDir)
    );
    const processedSegments = await Promise.all(segmentPromises);
    console.log('All segments processed');

    // Merge all segments
    const outputPath = path.join(tempDir, 'final_output.wav');
    const mergedAudio = await mergeAudioFiles(processedSegments, outputPath);
    console.log('Audio merge completed');

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
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
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('Error cleanup completed');
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
