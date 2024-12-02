@echo off
setlocal enabledelayedexpansion

echo Creating DynamoDB table for dialogue drafts...

:: Create the table
aws dynamodb create-table ^
    --table-name dialogue-drafts ^
    --attribute-definitions ^
        AttributeName=userId,AttributeType=S ^
        AttributeName=draftId,AttributeType=S ^
        AttributeName=createdAt,AttributeType=N ^
    --key-schema ^
        AttributeName=userId,KeyType=HASH ^
        AttributeName=draftId,KeyType=RANGE ^
    --global-secondary-indexes "[{\"IndexName\": \"CreatedAtIndex\",\"KeySchema\": [{\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},{\"AttributeName\": \"createdAt\", \"KeyType\": \"RANGE\"}],\"Projection\": {\"ProjectionType\": \"ALL\"},\"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5,\"WriteCapacityUnits\": 5}}]" ^
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 ^
    --tags Key=Environment,Value=production ^
    --region %AWS_REGION%

:: Wait for table to be active
:wait_loop
aws dynamodb describe-table --table-name dialogue-drafts --query "Table.TableStatus" --output text > status.tmp
set /p TABLE_STATUS=<status.tmp
del status.tmp

if "%TABLE_STATUS%"=="CREATING" (
    echo Waiting for table to be created...
    timeout /t 5 /nobreak > nul
    goto wait_loop
)

:: Enable Time to Live
aws dynamodb update-time-to-live ^
    --table-name dialogue-drafts ^
    --time-to-live-specification "Enabled=true, AttributeName=ttl" ^
    --region %AWS_REGION%

echo DynamoDB table 'dialogue-drafts' has been created successfully

endlocal
