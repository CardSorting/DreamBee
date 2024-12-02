const { ProcessingError } = require('./errors');
const fs = require('fs').promises;

class StreamingMerger {
    constructor(fileManager, pydubManager) {
        this.fileManager = fileManager;
        this.pydub = pydubManager;
        this.CHUNK_SIZE = 5; // Number of files to merge at once
    }

    async streamingMerge(inputFiles, outputPath) {
        console.log('Starting streaming merge:', {
            inputCount: inputFiles.length,
            output: outputPath,
            chunkSize: this.CHUNK_SIZE
        });

        try {
            // Create silence for padding
            const silencePath = this.fileManager.getPath('silence.wav');
            await this.pydub.generateSilence(silencePath, 0.05); // 50ms silence

            // Process files in chunks
            const chunks = [];
            for (let i = 0; i < inputFiles.length; i += this.CHUNK_SIZE) {
                const chunkFiles = inputFiles.slice(i, i + this.CHUNK_SIZE);
                const chunkPath = this.fileManager.getPath(`chunk_${i}.wav`);
                
                // For first file in chunk, just copy it
                await this.fileManager.copyFile(chunkFiles[0], chunkPath);

                // Merge remaining files in chunk with silence padding
                for (let j = 1; j < chunkFiles.length; j++) {
                    const nextFile = chunkFiles[j];
                    const tempPath = this.fileManager.getPath(`temp_chunk_${i}_${j}.wav`);
                    
                    await this.pydub.concatenateFiles([chunkPath, silencePath, nextFile], tempPath);
                    
                    await this.fileManager.deleteFile(chunkPath);
                    await this.fileManager.moveFile(tempPath, chunkPath);
                }

                chunks.push(chunkPath);
                
                console.log(`Processed chunk ${Math.floor(i / this.CHUNK_SIZE) + 1}/${Math.ceil(inputFiles.length / this.CHUNK_SIZE)}`);
            }

            // Merge chunks with silence padding
            let finalPath = chunks[0];
            for (let i = 1; i < chunks.length; i++) {
                const nextChunk = chunks[i];
                const tempPath = this.fileManager.getPath(`temp_final_${i}.wav`);
                
                await this.pydub.concatenateFiles([finalPath, silencePath, nextChunk], tempPath);
                
                await this.fileManager.deleteFile(finalPath);
                await this.fileManager.deleteFile(nextChunk);
                finalPath = tempPath;
            }

            // Move final result to output path
            await this.fileManager.moveFile(finalPath, outputPath);

            // Cleanup
            await this.fileManager.deleteFile(silencePath);
            for (const chunk of chunks) {
                try {
                    await this.fileManager.deleteFile(chunk);
                } catch (error) {
                    console.warn(`Failed to delete chunk ${chunk}:`, error);
                }
            }

            console.log('Streaming merge complete:', outputPath);
        } catch (error) {
            console.error('Error in streaming merge:', error);
            throw new ProcessingError('Failed to perform streaming merge', { cause: error });
        }
    }

    async compressStream(inputPath, outputPath) {
        console.log('Compressing merged audio:', {
            input: inputPath,
            output: outputPath
        });

        try {
            await this.pydub.compressAudio(inputPath, outputPath);
            console.log('Compression complete:', outputPath);
        } catch (error) {
            console.error('Error compressing audio:', error);
            throw new ProcessingError('Failed to compress merged audio', { cause: error });
        }
    }
}

module.exports = StreamingMerger;
