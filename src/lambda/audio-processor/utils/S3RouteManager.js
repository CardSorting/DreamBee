const path = require('path');
const { S3Error } = require('./errors');

class S3RouteManager {
    constructor(s3Manager) {
        this.s3 = s3Manager;
        this.routes = {
            input: {
                prefix: 'conversations',
                getPath: (conversationId, filename) => 
                    path.join('conversations', conversationId, 'input', filename)
            },
            merged: {
                prefix: 'conversations',
                getPath: (conversationId, taskId, format = 'mp3') => 
                    path.join('conversations', conversationId, 'merged', `${taskId}.${format}`)
            },
            temp: {
                prefix: 'temp',
                getPath: (conversationId, filename) => 
                    path.join('temp', conversationId, filename)
            }
        };
    }

    async uploadMergedAudio(conversationId, taskId, data, format = 'mp3') {
        try {
            const key = this.routes.merged.getPath(conversationId, taskId, format);
            console.log(`Uploading merged audio to ${key}`);

            let url;
            if (Buffer.isBuffer(data)) {
                const uploadParams = {
                    Bucket: this.s3.bucket,
                    Key: key,
                    Body: data,
                    ContentType: 'audio/mpeg'
                };
                
                const uploadResult = await this.s3.s3.upload(uploadParams).promise();
                url = uploadResult.Location;
            } else if (typeof data === 'string') {
                // Assume it's a file path
                url = await this.s3.uploadFile(key, data);
            } else {
                throw new S3Error('Invalid data type for upload');
            }

            const signedUrl = await this.s3.getSignedUrl(key);
            return {
                url: signedUrl,
                key,
                size: Buffer.isBuffer(data) ? data.length : null
            };
        } catch (error) {
            throw new S3Error('Failed to upload merged audio', {
                conversationId,
                taskId,
                cause: error
            });
        }
    }

    async uploadTempFile(conversationId, filename, data) {
        try {
            const key = this.routes.temp.getPath(conversationId, filename);
            console.log(`Uploading temp file to ${key}`);

            let url;
            if (Buffer.isBuffer(data)) {
                const uploadParams = {
                    Bucket: this.s3.bucket,
                    Key: key,
                    Body: data,
                    ContentType: 'audio/mpeg'
                };
                
                const uploadResult = await this.s3.s3.upload(uploadParams).promise();
                url = uploadResult.Location;
            } else if (typeof data === 'string') {
                // Assume it's a file path
                url = await this.s3.uploadFile(key, data);
            } else {
                throw new S3Error('Invalid data type for upload');
            }

            return {
                url,
                key,
                size: Buffer.isBuffer(data) ? data.length : null
            };
        } catch (error) {
            throw new S3Error('Failed to upload temp file', {
                conversationId,
                filename,
                cause: error
            });
        }
    }

    async downloadFile(key, outputPath) {
        try {
            await this.s3.downloadFile(key, outputPath);
        } catch (error) {
            throw new S3Error('Failed to download file', {
                key,
                outputPath,
                cause: error
            });
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        try {
            return await this.s3.getSignedUrl(key, expiresIn);
        } catch (error) {
            throw new S3Error('Failed to generate signed URL', {
                key,
                cause: error
            });
        }
    }

    async deleteFile(key) {
        try {
            const deleteParams = {
                Bucket: this.s3.bucket,
                Key: key
            };
            await this.s3.s3.deleteObject(deleteParams).promise();
        } catch (error) {
            throw new S3Error('Failed to delete file', {
                key,
                cause: error
            });
        }
    }

    async cleanupTempFiles(conversationId) {
        try {
            const prefix = path.join('temp', conversationId);
            const listParams = {
                Bucket: this.s3.bucket,
                Prefix: prefix
            };

            const objects = await this.s3.s3.listObjectsV2(listParams).promise();
            if (objects.Contents && objects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: this.s3.bucket,
                    Delete: {
                        Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
                    }
                };
                await this.s3.s3.deleteObjects(deleteParams).promise();
            }
        } catch (error) {
            throw new S3Error('Failed to cleanup temp files', {
                conversationId,
                cause: error
            });
        }
    }
}

module.exports = S3RouteManager;
