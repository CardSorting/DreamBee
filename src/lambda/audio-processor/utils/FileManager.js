const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { promisify } = require('util');
const { FileSystemError, NetworkError } = require('./errors');

const access = promisify(fs.access);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const rmdir = promisify(fs.rmdir);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

class FileManager {
    constructor(tempDir) {
        this.tempDir = tempDir;
        this.managedFiles = new Set(); // Track files for cleanup
    }

    async initialize() {
        try {
            await mkdir(this.tempDir, { recursive: true });
            console.log('Created temp directory:', this.tempDir);
        } catch (error) {
            throw new FileSystemError('Failed to create temp directory', { cause: error });
        }
    }

    async downloadFile(urlString, outputPath) {
        return new Promise((resolve, reject) => {
            console.log(`Downloading file from ${urlString} to ${outputPath}`);
            
            const handleDownload = (downloadUrl) => {
                const parsedUrl = new URL(downloadUrl);
                const options = {
                    hostname: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'AWS-Lambda-Function',
                        'Accept': '*/*'
                    }
                };

                const request = https.get(options, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        console.log(`Following redirect to: ${response.headers.location}`);
                        handleDownload(response.headers.location);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new NetworkError(
                            `Failed to download file: ${response.statusCode} - ${response.statusMessage}`,
                            { statusCode: response.statusCode, url: urlString }
                        ));
                        return;
                    }

                    const writeStream = fs.createWriteStream(outputPath);
                    response.pipe(writeStream);

                    writeStream.on('finish', () => {
                        writeStream.close();
                        this.managedFiles.add(outputPath);
                        console.log(`Successfully downloaded file to ${outputPath}`);
                        resolve();
                    });

                    writeStream.on('error', (err) => {
                        fs.unlink(outputPath).catch(console.error);
                        console.error(`Error writing file: ${err}`);
                        reject(new FileSystemError('Error writing downloaded file', { cause: err }));
                    });
                });

                request.on('error', (err) => {
                    console.error(`Error downloading file: ${err}`);
                    reject(new NetworkError('Network error during download', { cause: err }));
                });

                request.on('timeout', () => {
                    request.destroy();
                    reject(new NetworkError('Download timeout', { url: urlString }));
                });
            };

            handleDownload(urlString);
        });
    }

    async verifyFile(filePath) {
        try {
            const stats = await stat(filePath);
            console.log(`File size: ${stats.size} bytes`);
            if (stats.size === 0) {
                throw new FileSystemError('File is empty', { path: filePath });
            }
            return stats;
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            throw new FileSystemError('Failed to verify file', { 
                path: filePath,
                cause: error 
            });
        }
    }

    async writeFile(filePath, content) {
        try {
            await writeFile(filePath, content);
            this.managedFiles.add(filePath);
            console.log(`Successfully wrote file: ${filePath}`);
        } catch (error) {
            throw new FileSystemError('Failed to write file', {
                path: filePath,
                cause: error
            });
        }
    }

    async readFile(filePath) {
        try {
            const content = await readFile(filePath);
            console.log(`Successfully read file: ${filePath}`);
            return content;
        } catch (error) {
            throw new FileSystemError('Failed to read file', {
                path: filePath,
                cause: error
            });
        }
    }

    async deleteFile(filePath) {
        try {
            await unlink(filePath);
            this.managedFiles.delete(filePath);
            console.log(`Successfully deleted file: ${filePath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') { // Ignore if file doesn't exist
                throw new FileSystemError('Failed to delete file', {
                    path: filePath,
                    cause: error
                });
            }
        }
    }

    getPath(...segments) {
        const filePath = path.join(this.tempDir, ...segments);
        return filePath;
    }

    async cleanupFile(filePath) {
        try {
            const stats = await stat(filePath);
            if (stats.isDirectory()) {
                const files = await readdir(filePath);
                for (const file of files) {
                    await this.cleanupFile(path.join(filePath, file));
                }
                await rmdir(filePath);
            } else {
                await this.deleteFile(filePath);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error cleaning up ${filePath}:`, error);
            }
        }
    }

    async cleanup() {
        console.log('Starting cleanup...');
        
        try {
            // First try to clean up managed files
            const managedFilesArray = Array.from(this.managedFiles);
            for (const filePath of managedFilesArray) {
                await this.deleteFile(filePath);
            }
            this.managedFiles.clear();

            // Then recursively clean up the temp directory
            if (await this.exists(this.tempDir)) {
                const files = await readdir(this.tempDir);
                for (const file of files) {
                    await this.cleanupFile(path.join(this.tempDir, file));
                }
                await rmdir(this.tempDir);
            }
            
            console.log('Cleanup completed');
        } catch (error) {
            console.error('Cleanup error:', error);
            throw new FileSystemError('Failed to cleanup directory', {
                path: this.tempDir,
                cause: error
            });
        }
    }

    async exists(filePath) {
        try {
            await access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = FileManager;
