import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { FileManager } from '@/utils/audio-processing/file-manager'

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

def main():
    try:
        # Get segments and temp dir from arguments
        segments = ${JSON.stringify(segments)}
        temp_dir = '${tempDir.replace(/\\/g, '\\\\')}'
        
        print('Starting audio processing', file=sys.stderr)
        
        # Create output file path
        output_path = os.path.join(temp_dir, 'output.mp3')
        
        # Process each segment
        with open(output_path, 'wb') as outfile:
            for i, segment in enumerate(segments):
                print(f'Processing segment {i + 1}/{len(segments)}', file=sys.stderr)
                
                # Download segment
                try:
                    response = urllib.request.urlopen(segment['url'])
                    audio_data = response.read()
                    print(f'Downloaded {len(audio_data)} bytes', file=sys.stderr)
                    
                    # Write to output file
                    outfile.write(audio_data)
                    print(f'Wrote segment to output file', file=sys.stderr)
                    
                except Exception as e:
                    print(f'Error downloading segment: {str(e)}', file=sys.stderr)
                    continue
                
                # Report progress
                progress = ((i + 1) / len(segments)) * 100
                print(f'progress:{progress}')
                sys.stdout.flush()
        
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
