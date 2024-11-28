const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Natural silence generation settings
const SILENCE_SETTINGS = {
  SAMPLE_RATE: 44100,
  CHANNELS: 2,
  BYTES_PER_SAMPLE: 2,
  FADE_DURATION: 0.05  // 50ms fade in/out for silences
};

class AudioAssembler {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'dialogue-audio');
  }

  async downloadFile(url, localPath) {
    const response = await fetch(url);
    const buffer = await response.buffer();
    await fs.writeFile(localPath, buffer);
    return localPath;
  }

  createSilenceBuffer(duration) {
    const numSamples = Math.ceil(duration * SILENCE_SETTINGS.SAMPLE_RATE);
    const buffer = Buffer.alloc(numSamples * SILENCE_SETTINGS.CHANNELS * SILENCE_SETTINGS.BYTES_PER_SAMPLE);
    
    // Calculate fade samples
    const fadeSamples = Math.ceil(SILENCE_SETTINGS.FADE_DURATION * SILENCE_SETTINGS.SAMPLE_RATE);
    
    // Apply fade in/out to make silence transitions smoother
    for (let i = 0; i < numSamples; i++) {
      let amplitude = 0;
      
      // Fade in
      if (i < fadeSamples) {
        amplitude = (i / fadeSamples) * 0.1; // 10% max amplitude for silence
      }
      // Fade out
      else if (i > numSamples - fadeSamples) {
        amplitude = ((numSamples - i) / fadeSamples) * 0.1;
      }
      // Middle section
      else {
        amplitude = 0.1;
      }
      
      // Write amplitude to both channels
      const value = Math.floor(amplitude * 32767); // Convert to 16-bit
      const offset = i * SILENCE_SETTINGS.CHANNELS * SILENCE_SETTINGS.BYTES_PER_SAMPLE;
      buffer.writeInt16LE(value, offset);
      buffer.writeInt16LE(value, offset + 2);
    }
    
    return buffer;
  }

  async concatenateAudioFiles(segments, outputPath) {
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

      // Read all audio files and calculate total size needed
      const audioBuffers = await Promise.all(
        downloads.map(async (segment) => {
          const buffer = await fs.readFile(segment.localPath);
          return {
            buffer,
            startTime: segment.startTime,
            endTime: segment.endTime
          };
        })
      );

      // Calculate total duration and size
      const totalDuration = Math.max(...segments.map(s => s.endTime));
      const totalBytes = Math.ceil(totalDuration * SILENCE_SETTINGS.SAMPLE_RATE * 
                                 SILENCE_SETTINGS.CHANNELS * SILENCE_SETTINGS.BYTES_PER_SAMPLE);

      // Create output buffer
      const outputBuffer = Buffer.alloc(totalBytes);

      // Write each audio segment at its correct time position
      for (let i = 0; i < audioBuffers.length; i++) {
        const { buffer, startTime } = audioBuffers[i];
        const startOffset = Math.floor(startTime * SILENCE_SETTINGS.SAMPLE_RATE * 
                                     SILENCE_SETTINGS.CHANNELS * SILENCE_SETTINGS.BYTES_PER_SAMPLE);

        // Create and write silence before segment if needed
        if (i > 0) {
          const prevSegment = audioBuffers[i - 1];
          const silenceDuration = startTime - prevSegment.endTime;
          if (silenceDuration > 0) {
            const silenceBuffer = this.createSilenceBuffer(silenceDuration);
            const silenceOffset = Math.floor(prevSegment.endTime * SILENCE_SETTINGS.SAMPLE_RATE * 
                                          SILENCE_SETTINGS.CHANNELS * SILENCE_SETTINGS.BYTES_PER_SAMPLE);
            silenceBuffer.copy(outputBuffer, silenceOffset);
          }
        }

        // Write audio segment
        buffer.copy(outputBuffer, startOffset);
      }

      // Write the final file
      await fs.writeFile(outputPath, outputBuffer);

      // Clean up temp files
      console.log('Cleaning up...');
      await Promise.all(
        downloads.map(d => fs.unlink(d.localPath))
      );

      console.log('Audio assembly completed successfully');
    } catch (error) {
      console.error('Error assembling audio:', error);
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
  AudioAssembler,
  audioAssembler: new AudioAssembler()
};
