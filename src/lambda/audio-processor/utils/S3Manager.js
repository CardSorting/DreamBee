const AWS = require('aws-sdk');
const fs = require('fs');
const { S3Error } = require('./errors');

class S3Manager {
    constructor(bucket) {
        this.s3 = new AWS.S3();
        this.bucket = bucket;
    }

    async uploadFile(key, filePath, contentType = 'audio/mpeg') {
        console.log(`Uploading ${filePath} to S3://${this.bucket}/${key}`);
        
        const fileStream = fs.createReadStream(filePath);
        const uploadParams = {
            Bucket: this.bucket,
            Key: key,
            Body: fileStream,
            ContentType: contentType
        };

        try {
            const result = await this.s3.upload(uploadParams).promise();
            console.log(`Successfully uploaded to ${result.Location}`);
            return result.Location;
        } catch (error) {
            console.error('Error uploading to S3:', error);
            throw new S3Error('Failed to upload to S3', { 
                bucket: this.bucket,
                key,
                cause: error 
            });
        }
    }

    async downloadFile(key, outputPath) {
        console.log(`Downloading S3://${this.bucket}/${key} to ${outputPath}`);

        const downloadParams = {
            Bucket: this.bucket,
            Key: key
        };

        try {
            const writeStream = fs.createWriteStream(outputPath);
            const s3Stream = this.s3.getObject(downloadParams).createReadStream();

            await new Promise((resolve, reject) => {
                s3Stream.pipe(writeStream)
                    .on('error', reject)
                    .on('finish', resolve);
            });

            console.log(`Successfully downloaded to ${outputPath}`);
        } catch (error) {
            console.error('Error downloading from S3:', error);
            throw new S3Error('Failed to download from S3', {
                bucket: this.bucket,
                key,
                cause: error
            });
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: key,
                Expires: expiresIn
            };

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            return url;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            throw new S3Error('Failed to generate signed URL', {
                bucket: this.bucket,
                key,
                cause: error
            });
        }
    }

    generateKey(prefix, filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${prefix}/${timestamp}-${filename}`;
    }
}

module.exports = S3Manager;
