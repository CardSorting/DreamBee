const { ProcessingError } = require('./errors');

class AudioMerger {
    constructor(fileManager, pydubManager) {
        this.fileManager = fileManager;
        this.pydub = pydubManager;
    }

    async mergeAudioFiles(inputFiles, outputPath) {
        console.log('Merging audio files:', {
            inputCount: inputFiles.length,
            output: outputPath
        });

        try {
            // Create silence for padding if needed
            const silencePath = this.fileManager.getPath('silence.wav');
            await this.pydub.generateSilence(silencePath, 0.05); // 50ms silence

            // Create a temporary WAV file for intermediate merging
            const tempPath = this.fileManager.getPath('temp_merged.wav');
            
            // Copy first file to temp
            await this.fileManager.copyFile(inputFiles[0], tempPath);

            // Merge each subsequent file
            for (let i = 1; i < inputFiles.length; i++) {
                const nextFile = inputFiles[i];
                const nextTempPath = this.fileManager.getPath(`temp_merged_${i}.wav`);

                // Add silence between segments
                const withSilencePath = this.fileManager.getPath(`with_silence_${i}.wav`);
                await this.pydub.concatenateFiles([tempPath, silencePath, nextFile], withSilencePath);

                // Move to next temp file
                await this.fileManager.moveFile(withSilencePath, nextTempPath);
                await this.fileManager.deleteFile(tempPath);
                await this.fileManager.moveFile(nextTempPath, tempPath);
            }

            // Compress final result
            await this.pydub.compressAudio(tempPath, outputPath);

            // Cleanup
            await this.fileManager.deleteFile(tempPath);
            await this.fileManager.deleteFile(silencePath);

            console.log('Audio merge complete:', outputPath);
        } catch (error) {
            console.error('Error merging audio:', error);
            throw new ProcessingError('Failed to merge audio files', { cause: error });
        }
    }
}

module.exports = AudioMerger;
