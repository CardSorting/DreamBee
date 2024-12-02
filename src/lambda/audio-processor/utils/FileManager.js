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
const chmod = promisify(fs.chmod);

class FileManager {
    constructor(tempDir) {
        this.tempDir = tempDir.startsWith('/tmp') ? tempDir : path.join('/tmp', path.basename(tempDir));
        this.managedFiles = new Set();
    }

    async initialize() {
        try {
            console.log('Initializing FileManager with temp directory:', this.tempDir);

            try {
                await access('/tmp', fs.constants.W_OK);
                console.log('/tmp directory is writable');
            } catch (error) {
                console.error('Error accessing /tmp directory:', error);
                throw new FileSystemError('Cannot access /tmp directory', { cause: error });
            }

            await mkdir(this.tempDir, { 
                recursive: true,
                mode: 0o755
            });
            
            await chmod(this.tempDir, 0o755);
            
            const testFile = path.join(this.tempDir, '.test');
            await writeFile(testFile, 'test');
            await unlink(testFile);
            
            console.log('Successfully initialized temp directory:', this.tempDir);
            
            const contents = await readdir(this.tempDir);
            console.log('Temp directory contents:', contents);
            
            const stats = await stat(this.tempDir);
            console.log('Temp directory stats:', {
                mode: stats.mode.toString(8),
                uid: stats.uid,
                gid: stats.gid,
                size: stats.size
            });
        } catch (error) {
            console.error('Failed to initialize temp directory:', error);
            throw new FileSystemError('Failed to initialize temp directory', { 
                path: this.tempDir,
                cause: error
            });
        }
    }

    async downloadFile(urlString, outputPath) {
        return new Promise((resolve, reject) => {
            console.log(`Downloading file from ${urlString} to ${outputPath}`);
            
            const handleDownload = (downloadUrl) => {
                try {
                    const parsedUrl = new URL(downloadUrl);
                    const options = {
                        hostname: parsedUrl.hostname,
                        path: parsedUrl.pathname + parsedUrl.search,
                        method: 'GET',
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'AWS-Lambda-Function',
                            'Accept': '*/*'
                        },
                        rejectUnauthorized: true // Enforce SSL verification
                    };

                    console.log('Download options:', {
                        hostname: options.hostname,
                        path: options.path.substring(0, 100) + '...' // Truncate for logging
                    });

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

                        const contentLength = parseInt(response.headers['content-length'], 10);
                        if (contentLength === 0) {
                            reject(new NetworkError('Empty response from server'));
                            return;
                        }

                        const writeStream = fs.createWriteStream(outputPath, { 
                            mode: 0o644,
                            flags: 'w'
                        });

                        let downloadedSize = 0;
                        response.on('data', (chunk) => {
                            downloadedSize += chunk.length;
                            if (contentLength) {
                                const progress = Math.round((downloadedSize / contentLength) * 100);
                                if (progress % 20 === 0) { // Log every 20%
                                    console.log(`Download progress: ${progress}%`);
                                }
                            }
                        });

                        writeStream.on('finish', async () => {
                            writeStream.close();
                            this.managedFiles.add(outputPath);

                            try {
                                const stats = await stat(outputPath);
                                if (stats.size === 0) {
                                    reject(new FileSystemError('Downloaded file is empty'));
                                    return;
                                }

                                if (contentLength && stats.size !== contentLength) {
                                    reject(new FileSystemError(
                                        `Size mismatch: expected ${contentLength}, got ${stats.size}`
                                    ));
                                    return;
                                }

                                console.log(`Successfully downloaded file to ${outputPath} (${stats.size} bytes)`);
                                resolve();
                            } catch (error) {
                                reject(new FileSystemError('Error verifying downloaded file', { cause: error }));
                            }
                        });

                        writeStream.on('error', (err) => {
                            fs.unlink(outputPath).catch(console.error);
                            console.error(`Error writing file: ${err}`);
                            reject(new FileSystemError('Error writing downloaded file', { cause: err }));
                        });

                        response.pipe(writeStream);
                    });

                    request.on('error', (err) => {
                        console.error(`Error downloading file: ${err}`);
                        reject(new NetworkError('Network error during download', { cause: err }));
                    });

                    request.on('timeout', () => {
                        request.destroy();
                        reject(new NetworkError('Download timeout', { url: urlString }));
                    });
                } catch (error) {
                    console.error('Error in download process:', error);
                    reject(new NetworkError('Failed to process download', { cause: error }));
                }
            };

            handleDownload(urlString);
        });
    }

    async verifyFile(filePath) {
        try {
            const stats = await stat(filePath);
            console.log(`File verification for ${filePath}:`, {
                size: stats.size,
                mode: stats.mode.toString(8),
                uid: stats.uid,
                gid: stats.gid
            });
            
            if (stats.size === 0) {
                throw new FileSystemError('File is empty', { path: filePath });
            }
            
            await access(filePath, fs.constants.R_OK | fs.constants.W_OK);
            
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
            const dir = path.dirname(filePath);
            await mkdir(dir, { recursive: true, mode: 0o755 });
            
            await writeFile(filePath, content, { mode: 0o644 });
            await chmod(filePath, 0o644);
            
            this.managedFiles.add(filePath);
            console.log(`Successfully wrote file: ${filePath}`);
            
            await this.verifyFile(filePath);
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
            if (error.code !== 'ENOENT') {
                throw new FileSystemError('Failed to delete file', {
                    path: filePath,
                    cause: error
                });
            }
        }
    }

    getPath(...segments) {
        const filePath = path.join(this.tempDir, ...segments);
        if (!filePath.startsWith(this.tempDir)) {
            throw new FileSystemError('Invalid path: Must be within temp directory', {
                path: filePath,
                tempDir: this.tempDir
            });
        }
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
            const managedFilesArray = Array.from(this.managedFiles);
            for (const filePath of managedFilesArray) {
                await this.deleteFile(filePath);
            }
            this.managedFiles.clear();

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
