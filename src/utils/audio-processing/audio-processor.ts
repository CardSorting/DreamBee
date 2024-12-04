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
import io
from pydub import AudioSegment
import tempfile

def download_segment(url, temp_dir):
    try:
        response = urllib.request.urlopen(url)
        temp_path = os.path.join(temp_dir, 'temp.mp3')
        with open(temp_path, 'wb') as f:
            f.write(response.read())
        return AudioSegment.from_mp3(temp_path)
    except Exception as e:
        print(f'Error downloading segment: {str(e)}', file=sys.stderr)
        raise

def main():
    try:
        segments = ${JSON.stringify(segments)}
        temp_dir = '${tempDir.replace(/\\/g, '\\\\')}'
        output_path = os.path.join(temp_dir, 'output.mp3')
        
        print('Starting audio processing', file=sys.stderr)
        
        # Initialize final audio
        final_audio = AudioSegment.silent(duration=0)
        current_position = 0

        for i, segment in enumerate(segments):
            print(f'Processing segment {i + 1}/{len(segments)}', file=sys.stderr)
            
            # Calculate timing
            start_time_ms = int(float(segment['startTime']) * 1000)
            silence_needed = start_time_ms - current_position
            
            # Add silence if needed
            if silence_needed > 0:
                print(f'Adding {silence_needed}ms of silence', file=sys.stderr)
                final_audio += AudioSegment.silent(duration=silence_needed)
                current_position += silence_needed
            
            # Add small pause between different speakers
            if segment.get('previousCharacter') and segment['previousCharacter'] != segment['character']:
                pause_duration = 300  # 300ms pause between speakers
                final_audio += AudioSegment.silent(duration=pause_duration)
                current_position += pause_duration
            
            # Download and process segment
            try:
                audio_segment = download_segment(segment['url'], temp_dir)
                print(f'Downloaded audio segment of length {len(audio_segment)}ms', file=sys.stderr)
                
                # Add audio segment
                final_audio += audio_segment
                
                # Update position
                segment_duration = len(audio_segment)
                current_position += segment_duration
                
                print(f'Added segment, current position: {current_position}ms', file=sys.stderr)
                
            except Exception as e:
                print(f'Error processing segment: {str(e)}', file=sys.stderr)
                continue
            
            # Report progress
            progress = ((i + 1) / len(segments)) * 100
            print(f'progress:{progress}')
            sys.stdout.flush()
        
        # Export final audio
        final_audio.export(output_path, format='mp3')
        
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
