const { AudioProcessingError } = require('./errors');
const path = require('path');

class AudioMerger {
    constructor(fileManager, ffmpegManager) {
        this.fileManager = fileManager;
        this.ffmpeg = ffmpegManager;
        this.MIN_SILENCE_DURATION = 0.3;
        this.MAX_SILENCE_DURATION = 0.7;
        this.OPTIMAL_BATCH_SIZE = 3;
        this.MAX_MERGE_LEVEL = 3;
    }

    calculateSilenceDuration(currentSegment, nextSegment) {
        if (!nextSegment) return this.MIN_SILENCE_DURATION;
        
        const gap = nextSegment.startTime - currentSegment.endTime;
        if (gap <= 0) return this.MIN_SILENCE_DURATION;
        
        const duration = Math.min(Math.max(gap * 0.5, this.MIN_SILENCE_DURATION), this.MAX_SILENCE_DURATION);
        console.log(`Natural gap: ${gap}s, using silence duration: ${duration}s`);
        return duration;
    }

    async createSilenceFile(duration, index) {
        const silencePath = this.fileManager.getPath(`silence_${Date.now()}_${index}.wav`);
        await this.ffmpeg.generateSilence(duration, silencePath);
        return silencePath;
    }

    async createMergeList(segments, files, level = 0) {
        const listPath = this.fileManager.getPath(`merge_list_${level}_${Date.now()}.txt`);
        const silenceFiles = [];
        let fileList = '';

        for (let i = 0; i < files.length; i++) {
            if (i > 0 && segments[i]) {
                const silencePath = await this.createSilenceFile(
                    this.calculateSilenceDuration(segments[i - 1], segments[i]),
                    `${level}_${i}`
                );
                silenceFiles.push(silencePath);
                fileList += `file '${silencePath}'\n`;
            }
            fileList += `file '${files[i]}'\n`;
        }

        await this.fileManager.writeFile(listPath, fileList);
        return { listPath, silenceFiles };
    }

    async mergeFiles(inputFiles, outputPath) {
        const args = [
            '-f', 'concat',
            '-safe', '0',
            '-i', inputFiles,
            '-c', 'copy',
            '-y',
            outputPath
        ];
        await this.ffmpeg.runCommand(args);
        await this.fileManager.verifyFile(outputPath);
    }

    async mergeBatch(segments, files, level = 0) {
        const batchOutputPath = this.fileManager.getPath(`batch_${level}_${Date.now()}.wav`);
        const { listPath, silenceFiles } = await this.createMergeList(segments, files, level);

        try {
            await this.mergeFiles(listPath, batchOutputPath);

            // Cleanup intermediate files
            await this.fileManager.deleteFile(listPath);
            for (const file of silenceFiles) {
                await this.fileManager.deleteFile(file);
            }

            return batchOutputPath;
        } catch (error) {
            console.error(`Error merging batch at level ${level}:`, error);
            throw new AudioProcessingError(`Failed to merge batch at level ${level}`, { cause: error });
        }
    }

    splitIntoBatches(items) {
        const batches = [];
        for (let i = 0; i < items.length; i += this.OPTIMAL_BATCH_SIZE) {
            batches.push(items.slice(i, i + this.OPTIMAL_BATCH_SIZE));
        }
        return batches;
    }

    async mergeLevel(segments, files, level = 0) {
        if (files.length <= this.OPTIMAL_BATCH_SIZE) {
            return this.mergeBatch(segments, files, level);
        }

        const segmentBatches = this.splitIntoBatches(segments);
        const fileBatches = this.splitIntoBatches(files);
        const mergedBatches = [];

        for (let i = 0; i < fileBatches.length; i++) {
            const mergedBatch = await this.mergeBatch(
                segmentBatches[i] || [],
                fileBatches[i],
                level
            );
            mergedBatches.push(mergedBatch);

            // Cleanup original files after successful batch merge
            for (const file of fileBatches[i]) {
                await this.fileManager.deleteFile(file);
            }
        }

        // Recursively merge the batches
        return this.mergeLevel(segments, mergedBatches, level + 1);
    }

    async compressFinal(inputPath, outputPath) {
        const args = [
            '-i', inputPath,
            '-codec:a', 'libmp3lame',
            '-q:a', '2',  // High quality VBR
            '-y',
            outputPath
        ];
        await this.ffmpeg.runCommand(args);
        await this.fileManager.verifyFile(outputPath);
    }

    async merge(segments, files) {
        console.log(`Starting hierarchical merge of ${files.length} files`);
        
        try {
            // First level merge with silence insertion
            const mergedPath = await this.mergeLevel(segments, files);
            
            // Compress final output
            const finalOutputPath = this.fileManager.getPath(`final_output_${Date.now()}.mp3`);
            await this.compressFinal(mergedPath, finalOutputPath);
            
            // Cleanup intermediate merged file
            await this.fileManager.deleteFile(mergedPath);

            const finalAudio = await this.fileManager.readFile(finalOutputPath);
            await this.fileManager.deleteFile(finalOutputPath);

            return {
                data: finalAudio,
                format: 'mp3'
            };
        } catch (error) {
            console.error('Error in merge process:', error);
            throw new AudioProcessingError('Failed to complete merge process', { cause: error });
        }
    }
}

module.exports = AudioMerger;
