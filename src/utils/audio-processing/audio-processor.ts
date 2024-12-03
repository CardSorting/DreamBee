import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { FileManager } from './file-manager'

export interface AudioSegment {
  url: string
  startTime: number
  endTime: number
  character: string
  previousCharacter?: string
}

export interface ProcessingProgress {
  phase: string
  progress: number
  details?: any
}

export class AudioProcessingError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message)
    this.name = 'AudioProcessingError'
  }
}

export class AudioProcessor {
  constructor(
    private readonly fileManager: FileManager
  ) {}

  async processSegments(
    segments: AudioSegment[],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Buffer> {
    const tempDir = await this.fileManager.createTempDir()

    try {
      onProgress?.({
        phase: 'processing',
        progress: 0,
        details: { totalSegments: segments.length }
      })

      const pythonScript = `
import os
import sys
import urllib.request
import wave
import io
import array
import struct

def create_silence(duration_ms, sample_rate=44100):
    # Calculate number of frames needed for silence
    num_frames = int((duration_ms / 1000.0) * sample_rate)
    return array.array('h', [0] * num_frames)

def main():
    try:
        # Get segments and temp dir from arguments
        segments = ${JSON.stringify(segments)}
        temp_dir = '${tempDir.replace(/\\/g, '\\\\')}'
        
        print('Starting audio processing', file=sys.stderr)
        
        # Create output file path
        output_path = os.path.join(temp_dir, 'output.mp3')
        
        # Process each segment
        final_audio = array.array('h')
        current_position = 0
        sample_rate = 44100  # Standard sample rate

        for i, segment in enumerate(segments):
            print(f'Processing segment {i + 1}/{len(segments)}', file=sys.stderr)
            
            # Calculate silence needed before this segment
            start_time_ms = int(float(segment['startTime']) * 1000)
            silence_needed = start_time_ms - current_position
            
            if silence_needed > 0:
                print(f'Adding {silence_needed}ms of silence', file=sys.stderr)
                silence = create_silence(silence_needed, sample_rate)
                final_audio.extend(silence)
                current_position += silence_needed
            
            # Download and process segment
            try:
                response = urllib.request.urlopen(segment['url'])
                audio_data = response.read()
                print(f'Downloaded {len(audio_data)} bytes', file=sys.stderr)
                
                # Write segment to temp file
                segment_path = os.path.join(temp_dir, f'segment_{i}.mp3')
                with open(segment_path, 'wb') as f:
                    f.write(audio_data)
                
                # Convert to WAV and read frames
                wav_path = os.path.join(temp_dir, f'segment_{i}.wav')
                os.system(f'ffmpeg -i {segment_path} {wav_path} -y')
                
                with wave.open(wav_path, 'rb') as wav:
                    frames = wav.readframes(wav.getnframes())
                    audio_array = array.array('h')
                    audio_array.frombytes(frames)
                    final_audio.extend(audio_array)
                
                # Update current position
                segment_duration = int(float(segment['endTime'] - segment['startTime']) * 1000)
                current_position += segment_duration
                
                print(f'Added segment, current position: {current_position}ms', file=sys.stderr)
                
            except Exception as e:
                print(f'Error processing segment: {str(e)}', file=sys.stderr)
                continue
            
            # Report progress
            progress = ((i + 1) / len(segments)) * 100
            print(f'progress:{progress}')
            sys.stdout.flush()
        
        # Write final audio to WAV
        final_wav_path = os.path.join(temp_dir, 'final.wav')
        with wave.open(final_wav_path, 'wb') as wav:
            wav.setnchannels(1)  # Mono
            wav.setsampwidth(2)  # 2 bytes per sample
            wav.setframerate(sample_rate)
            wav.writeframes(final_audio.tobytes())
        
        # Convert to MP3
        os.system(f'ffmpeg -i {final_wav_path} {output_path} -y')
        
        # Read and output the final file
        if os.path.exists(output_path):
            with open(output_path, 'rb') as f:
                result = f.read()
                print(f'Read {len(result)} bytes from output', file=sys.stderr)
                print(f'result:{result.hex()}')
                sys.stdout.flush()
        else:
            print('Output file does not exist', file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f'Error in main: {str(e)}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
`

      const result = await new Promise<Buffer>((resolve, reject) => {
        const process = spawn('python', ['-c', pythonScript])
        let resultHex = ''
        let errorOutput = ''

        process.stdout.on('data', (data) => {
          const output = data.toString()
          
          if (output.startsWith('progress:')) {
            const progress = parseFloat(output.split(':')[1])
            onProgress?.({
              phase: 'processing',
              progress,
              details: { totalSegments: segments.length }
            })
          } else if (output.startsWith('result:')) {
            resultHex = output.substring(7).trim()
          }
        })

        process.stderr.on('data', (data) => {
          errorOutput += data.toString()
          console.error('Python Debug:', data.toString().trim())
        })

        process.on('close', (code) => {
          console.log('Python process closed with code:', code)
          if (errorOutput) {
            console.log('Error output:', errorOutput)
          }

          if (code === 0 && resultHex) {
            try {
              const buffer = Buffer.from(resultHex, 'hex')
              resolve(buffer)
            } catch (err) {
              const error = err as Error
              reject(new AudioProcessingError(
                'Failed to parse result',
                error.message
              ))
            }
          } else {
            reject(new AudioProcessingError(
              'Python process failed',
              errorOutput || `Exit code: ${code}`
            ))
          }
        })
      })

      onProgress?.({
        phase: 'complete',
        progress: 100
      })

      return result

    } finally {
      await this.fileManager.cleanup(tempDir)
    }
  }
}
