const { PythonShell } = require('python-shell');
const { ProcessingError } = require('./errors');
const fs = require('fs').promises;
const path = require('path');

class PydubManager {
    constructor() {
        this.initialized = false;
        this.pythonScript = path.join(__dirname, 'pydub_operations.py');
    }

    async initialize() {
        try {
            console.log('Initializing PydubManager');
            await this.createPythonScript();
            this.initialized = true;
            console.log('PydubManager initialization complete');
        } catch (error) {
            console.error('PydubManager initialization failed:', error);
            throw new ProcessingError('Failed to initialize Pydub', { cause: error });
        }
    }

    async createPythonScript() {
        const pythonCode = `
from pydub import AudioSegment
import sys
import json
import os
import numpy as np

def normalize_audio(input_path, output_path):
    try:
        audio = AudioSegment.from_file(input_path)
        normalized = audio.normalize()
        normalized.export(output_path, format="wav")
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def trim_audio(input_path, output_path, start_time, end_time):
    try:
        audio = AudioSegment.from_file(input_path)
        trimmed = audio[start_time*1000:end_time*1000]
        trimmed.export(output_path, format="wav")
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def compress_audio(input_path, output_path, bitrate="128k"):
    try:
        audio = AudioSegment.from_file(input_path)
        audio.export(output_path, format="mp3", bitrate=bitrate)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def generate_silence(output_path, duration):
    try:
        silence = AudioSegment.silent(duration=duration*1000)
        silence.export(output_path, format="wav")
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def concatenate_files(input_files, output_path):
    try:
        combined = AudioSegment.empty()
        for file_path in input_files:
            audio = AudioSegment.from_file(file_path)
            combined += audio
        combined.export(output_path, format="wav")
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_audio_info(file_path):
    try:
        audio = AudioSegment.from_file(file_path)
        return {
            "success": True,
            "duration": len(audio) / 1000,
            "channels": audio.channels,
            "sample_width": audio.sample_width,
            "frame_rate": audio.frame_rate,
            "frame_count": int(audio.frame_count())
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def compare_audio_files(file1, file2):
    try:
        audio1 = AudioSegment.from_file(file1)
        audio2 = AudioSegment.from_file(file2)
        
        if len(audio1) != len(audio2):
            return {"success": True, "match": False, "reason": "Different durations"}
            
        samples1 = np.array(audio1.get_array_of_samples())
        samples2 = np.array(audio2.get_array_of_samples())
        
        if len(samples1) != len(samples2):
            return {"success": True, "match": False, "reason": "Different sample counts"}
            
        rms_diff = np.sqrt(np.mean((samples1 - samples2) ** 2))
        threshold = np.max([np.abs(samples1).max(), np.abs(samples2).max()]) * 0.01
        
        return {
            "success": True,
            "match": rms_diff <= threshold,
            "difference": float(rms_diff)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    command = sys.argv[1]
    args = json.loads(sys.argv[2])
    
    result = None
    if command == "normalize":
        result = normalize_audio(args["input"], args["output"])
    elif command == "trim":
        result = trim_audio(args["input"], args["output"], args["start"], args["end"])
    elif command == "compress":
        result = compress_audio(args["input"], args["output"], args.get("bitrate", "128k"))
    elif command == "silence":
        result = generate_silence(args["output"], args["duration"])
    elif command == "concatenate":
        result = concatenate_files(args["input_files"], args["output"])
    elif command == "info":
        result = get_audio_info(args["input"])
    elif command == "compare":
        result = compare_audio_files(args["file1"], args["file2"])
    
    print(json.dumps(result))
`;
        await fs.writeFile(this.pythonScript, pythonCode);
    }

    checkInitialized() {
        if (!this.initialized) {
            throw new ProcessingError('PydubManager not initialized');
        }
    }

    async runPythonCommand(command, args) {
        this.checkInitialized();
        
        return new Promise((resolve, reject) => {
            const options = {
                mode: 'json',
                pythonPath: 'python',
                args: [command, JSON.stringify(args)]
            };

            PythonShell.run(this.pythonScript, options)
                .then(results => {
                    const result = results[0];
                    if (!result.success) {
                        throw new Error(result.error);
                    }
                    resolve(result);
                })
                .catch(error => reject(error));
        });
    }

    async normalizeAudio(inputPath, outputPath) {
        console.log(`Normalizing audio: ${inputPath} -> ${outputPath}`);
        try {
            await this.runPythonCommand('normalize', { input: inputPath, output: outputPath });
        } catch (error) {
            throw new ProcessingError('Failed to normalize audio', {
                cause: error,
                input: inputPath,
                output: outputPath
            });
        }
    }

    async trimAudio(inputPath, outputPath, startTime, endTime) {
        console.log(`Trimming audio: ${inputPath} -> ${outputPath} (${startTime}s to ${endTime}s)`);
        try {
            await this.runPythonCommand('trim', {
                input: inputPath,
                output: outputPath,
                start: startTime,
                end: endTime
            });
        } catch (error) {
            throw new ProcessingError('Failed to trim audio', {
                cause: error,
                input: inputPath,
                output: outputPath,
                timing: { startTime, endTime }
            });
        }
    }

    async compressAudio(inputPath, outputPath, options = {}) {
        console.log(`Compressing audio: ${inputPath} -> ${outputPath}`);
        try {
            await this.runPythonCommand('compress', {
                input: inputPath,
                output: outputPath,
                bitrate: options.bitrate || '128k'
            });
        } catch (error) {
            throw new ProcessingError('Failed to compress audio', {
                cause: error,
                input: inputPath,
                output: outputPath
            });
        }
    }

    async generateSilence(outputPath, duration) {
        console.log(`Generating ${duration}s silence: ${outputPath}`);
        try {
            await this.runPythonCommand('silence', {
                output: outputPath,
                duration: duration
            });
        } catch (error) {
            throw new ProcessingError('Failed to generate silence', {
                cause: error,
                duration,
                output: outputPath
            });
        }
    }

    async concatenateFiles(inputFiles, outputPath) {
        console.log(`Concatenating ${inputFiles.length} files to: ${outputPath}`);
        try {
            await this.runPythonCommand('concatenate', {
                input_files: inputFiles,
                output: outputPath
            });
        } catch (error) {
            throw new ProcessingError('Failed to concatenate audio files', {
                cause: error,
                input_files: inputFiles,
                output: outputPath
            });
        }
    }

    async getAudioInfo(filePath) {
        console.log(`Getting audio info: ${filePath}`);
        try {
            return await this.runPythonCommand('info', { input: filePath });
        } catch (error) {
            throw new ProcessingError('Failed to get audio information', {
                cause: error,
                file: filePath
            });
        }
    }

    async compareAudioFiles(file1, file2) {
        console.log(`Comparing audio files: ${file1} vs ${file2}`);
        try {
            return await this.runPythonCommand('compare', { file1, file2 });
        } catch (error) {
            throw new ProcessingError('Failed to compare audio files', {
                cause: error,
                files: [file1, file2]
            });
        }
    }
}

module.exports = PydubManager;
