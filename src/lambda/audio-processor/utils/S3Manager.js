const AWS = require('aws-sdk');
const fs = require('fs');
const crypto = require('crypto');
const { S3Error } = require('./errors');

class S3Manager {
    constructor(bucket) {
        if (!bucket) {
            throw new Error('S3 bucket name is required');
        }
        this.s3 = new AWS.S3({
            signatureVersion: 'v4',
            useAccelerateEndpoint: false
        });
        this.bucket = bucket;
        console.log(`Initialized S3Manager with bucket: ${bucket}`);
    }

    async uploadBuffer(key, buffer, contentType = 'audio/mpeg') {
        console.log(`Uploading buffer to S3://${this.bucket}/${key}`);
        
        if (!Buffer.isBuffer(buffer)) {
            throw new S3Error('Input must be a Buffer');
        }

        if (buffer.length === 0) {
            throw new S3Error('Buffer is empty');
        }

        // Calculate MD5 hash for integrity check
        const md5Hash = crypto.createHash('md5').update(buffer).digest('base64');
        
        const uploadParams = {
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ContentMD5: md5Hash
        };

        try {
            console.log(`Uploading ${buffer.length} bytes with MD5: ${md5Hash}`);
            console.log('First 32 bytes:', buffer.slice(0, 32));

            const result = await this.s3.upload(uploadParams).promise();
            console.log(`Successfully uploaded to ${result.Location}`);
            
            // Verify upload with MD5 check
            const headData = await this.verifyFile(key);
            const uploadedMd5 = headData.ETag.replace(/"/g, '');
            if (uploadedMd5 !== md5Hash) {
                throw new S3Error('Upload verification failed: MD5 mismatch', {
                    expected: md5Hash,
                    actual: uploadedMd5
                });
            }
            
            return result.Location;
        } catch (error) {
            console.error('Error uploading buffer to S3:', error);
            if (error.code === 'NoSuchBucket') {
                throw new S3Error(`Bucket ${this.bucket} does not exist`);
            }
            if (error.code === 'AccessDenied') {
                throw new S3Error('Access denied to S3 bucket. Check IAM permissions');
            }
            throw new S3Error('Failed to upload buffer to S3', { cause: error });
        }
    }

    async downloadToBuffer(key) {
        console.log(`Downloading S3://${this.bucket}/${key} to buffer`);

        const downloadParams = {
            Bucket: this.bucket,
            Key: key
        };

        try {
            // Verify the S3 object exists and get its size
            const headData = await this.s3.headObject(downloadParams).promise();
            console.log(`S3 object size: ${headData.ContentLength} bytes`);

            if (headData.ContentLength === 0) {
                throw new S3Error('S3 object is empty');
            }

            const { Body } = await this.s3.getObject(downloadParams).promise();
            
            // Verify downloaded data
            if (!Buffer.isBuffer(Body)) {
                throw new S3Error('Downloaded data is not a Buffer');
            }

            if (Body.length !== headData.ContentLength) {
                throw new S3Error(`Size mismatch: expected ${headData.ContentLength}, got ${Body.length}`);
            }

            // Verify MD5 hash
            const md5Hash = crypto.createHash('md5').update(Body).digest('base64');
            const expectedMd5 = headData.ETag.replace(/"/g, '');
            if (expectedMd5 !== md5Hash) {
                throw new S3Error('Download verification failed: MD5 mismatch', {
                    expected: expectedMd5,
                    actual: md5Hash
                });
            }

            console.log(`Successfully downloaded ${Body.length} bytes`);
            console.log('First 32 bytes:', Body.slice(0, 32));
            
            return Body;
        } catch (error) {
            console.error('Error downloading from S3:', error);
            if (error.code === 'NoSuchKey') {
                throw new S3Error(`File ${key} not found in bucket`);
            }
            if (error.code === 'AccessDenied') {
                throw new S3Error('Access denied to S3 bucket. Check IAM permissions');
            }
            throw new S3Error('Failed to download from S3', { cause: error });
        }
    }

    async downloadFile(key, outputPath) {
        console.log(`Downloading S3://${this.bucket}/${key} to ${outputPath}`);

        const downloadParams = {
            Bucket: this.bucket,
            Key: key
        };

        try {
            // Verify the S3 object exists and get its size
            const headData = await this.s3.headObject(downloadParams).promise();
            console.log(`S3 object size: ${headData.ContentLength} bytes`);

            if (headData.ContentLength === 0) {
                throw new S3Error('S3 object is empty');
            }

            // Create write stream with binary encoding
            const writeStream = fs.createWriteStream(outputPath, { 
                encoding: null, // binary
                mode: 0o644 // rw-r--r--
            });

            // Create hash stream for MD5 verification
            const hashStream = crypto.createHash('md5');

            // Create read stream from S3
            const s3Stream = this.s3.getObject(downloadParams).createReadStream();

            // Track downloaded size
            let downloadedSize = 0;
            s3Stream.on('data', chunk => {
                downloadedSize += chunk.length;
                hashStream.update(chunk);
            });

            await new Promise((resolve, reject) => {
                s3Stream
                    .on('error', reject)
                    .pipe(writeStream)
                    .on('error', reject)
                    .on('finish', () => {
                        console.log(`Downloaded ${downloadedSize} bytes`);
                        resolve();
                    });
            });

            // Verify downloaded file size
            const stats = await fs.promises.stat(outputPath);
            console.log(`Downloaded file size: ${stats.size} bytes`);

            if (stats.size !== headData.ContentLength) {
                throw new S3Error(`Size mismatch: expected ${headData.ContentLength}, got ${stats.size}`);
            }

            // Verify MD5 hash
            const md5Hash = hashStream.digest('base64');
            const expectedMd5 = headData.ETag.replace(/"/g, '');
            if (expectedMd5 !== md5Hash) {
                throw new S3Error('Download verification failed: MD5 mismatch', {
                    expected: expectedMd5,
                    actual: md5Hash
                });
            }

            console.log(`Successfully downloaded to ${outputPath}`);
            
            // Read and log first 32 bytes for verification
            const fileHandle = await fs.promises.open(outputPath, 'r');
            const buffer = Buffer.alloc(32);
            await fileHandle.read(buffer, 0, 32, 0);
            await fileHandle.close();
            console.log('First 32 bytes:', buffer);

        } catch (error) {
            console.error('Error downloading from S3:', error);
            // Clean up partial download if it exists
            try {
                await fs.promises.unlink(outputPath);
            } catch (unlinkError) {
                console.error('Error cleaning up partial download:', unlinkError);
            }
            if (error.code === 'NoSuchKey') {
                throw new S3Error(`File ${key} not found in bucket`);
            }
            if (error.code === 'AccessDenied') {
                throw new S3Error('Access denied to S3 bucket. Check IAM permissions');
            }
            throw new S3Error('Failed to download from S3', { cause: error });
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        try {
            // Verify the object exists first
            await this.verifyFile(key);

            const params = {
                Bucket: this.bucket,
                Key: key,
                Expires: expiresIn,
                ResponseContentType: 'audio/mpeg',
                ResponseContentDisposition: 'inline'
            };

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            console.log('Generated signed URL:', {
                key,
                urlLength: url.length,
                expiresIn: `${expiresIn} seconds`
            });

            return url;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            if (error.code === 'NoSuchKey') {
                throw new S3Error(`File ${key} not found in bucket`);
            }
            if (error.code === 'AccessDenied') {
                throw new S3Error('Access denied to S3 bucket. Check IAM permissions');
            }
            throw new S3Error('Failed to generate signed URL', { cause: error });
        }
    }

    async verifyFile(key) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: key
            };

            const headData = await this.s3.headObject(params).promise();
            
            if (headData.ContentLength === 0) {
                throw new S3Error('S3 object is empty');
            }

            console.log(`Verified S3 object:`, {
                key,
                size: headData.ContentLength,
                type: headData.ContentType,
                etag: headData.ETag
            });

            return headData;
        } catch (error) {
            console.error('Error verifying S3 object:', error);
            if (error.code === 'NoSuchKey') {
                throw new S3Error(`File ${key} not found in bucket`);
            }
            if (error.code === 'AccessDenied') {
                throw new S3Error('Access denied to S3 bucket. Check IAM permissions');
            }
            throw new S3Error('Failed to verify S3 object', { cause: error });
        }
    }

    generateKey(prefix, filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${prefix}/${timestamp}-${filename}`;
    }
}

module.exports = S3Manager;
