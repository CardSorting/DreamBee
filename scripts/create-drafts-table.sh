#!/bin/bash

# Create DynamoDB table for dialogue drafts
aws dynamodb create-table \
    --table-name dialogue-drafts \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=draftId,AttributeType=S \
        AttributeName=createdAt,AttributeType=N \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=draftId,KeyType=RANGE \
    --global-secondary-indexes '[
        {
            "IndexName": "CreatedAtIndex",
            "KeySchema": [
                {"AttributeName": "userId", "KeyType": "HASH"},
                {"AttributeName": "createdAt", "KeyType": "RANGE"}
            ],
            "Projection": {
                "ProjectionType": "ALL"
            },
            "ProvisionedThroughput": {
                "ReadCapacityUnits": 5,
                "WriteCapacityUnits": 5
            }
        }
    ]' \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --tags Key=Environment,Value=production \
    --region $AWS_REGION

# Wait for table to be created
aws dynamodb wait table-exists \
    --table-name dialogue-drafts \
    --region $AWS_REGION

# Enable Time to Live on the table
aws dynamodb update-time-to-live \
    --table-name dialogue-drafts \
    --time-to-live-specification "Enabled=true, AttributeName=ttl" \
    --region $AWS_REGION

echo "DynamoDB table 'dialogue-drafts' has been created successfully"
