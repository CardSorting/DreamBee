const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class FFmpegService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'dialogue-audio');
  }

  async downloadFile(url, localPath) {
    const response = await fetch(url);
    const buffer = await response.buffer();
    await fs.writeFile(localPath, buffer);
    return localPath;
  }

  createSilence(duration, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input('anullsrc')
        .inputOptions([
          '-f lavfi',
          '-t ' + duration
        ])
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async assemblePodcast(segments, outputPath) {
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });

      // Download all audio files
      console.log('Downloading audio files...');
      const downloads = await Promise.all(
        segments.map(async (segment, index) => {
          const localPath = path.join(this.tempDir, `segment_${index}.mp3`);
          await this.downloadFile(segment.url, localPath);
          return {
            ...segment,
            localPath
          };
        })
      );

      // Create silence files for gaps
      console.log('Creating silence files...');
      const silenceFiles = [];
      for (let i = 0; i < segments.length - 1; i++) {
        const currentSegment = segments[i];
        const nextSegment = segments[i + 1];
        const gapDuration = nextSegment.startTime - currentSegment.endTime;
        
        if (gapDuration > 0) {
          const silencePath = path.join(this.tempDir, `silence_${i}.mp3`);
          await this.createSilence(gapDuration, silencePath);
          silenceFiles.push({
            path: silencePath,
            duration: gapDuration
          });
        }
      }

      // Create concatenation file
      const concatFilePath = path.join(this.tempDir, 'concat.txt');
      const concatContent = [];
      
      // Add files in order with silences
      for (let i = 0; i < downloads.length; i++) {
        concatContent.push(`file '${downloads[i].localPath}'`);
        if (i < silenceFiles.length) {
          concatContent.push(`file '${silenceFiles[i].path}'`);
        }
      }
      
      await fs.writeFile(concatFilePath, concatContent.join('\n'));

      // Run FFmpeg concatenation
      console.log('Running FFmpeg concatenation...');
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatFilePath)
          .inputOptions(['-f concat', '-safe 0'])
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .output(outputPath)
          .on('progress', progress => {
            console.log(`Processing: ${Math.floor(progress.percent)}% done`);
          })
          .on('end', () => {
            console.log('FFmpeg processing finished');
            resolve();
          })
          .on('error', (err) => {
            console.error('Error:', err);
            reject(err);
          })
          .run();
      });

      // Clean up temp files
      console.log('Cleaning up...');
      await Promise.all([
        ...downloads.map(d => fs.unlink(d.localPath)),
        ...silenceFiles.map(s => fs.unlink(s.path)),
        fs.unlink(concatFilePath)
      ]);

      console.log('Podcast assembly completed successfully');
    } catch (error) {
      console.error('Error assembling podcast:', error);
      throw error;
    } finally {
      // Try to clean up temp directory
      try {
        await fs.rmdir(this.tempDir, { recursive: true });
      } catch (error) {
        console.warn('Warning: Failed to clean up temp directory:', error);
      }
    }
  }
}

module.exports = {
  FFmpegService,
  ffmpeg: new FFmpegService()
};
