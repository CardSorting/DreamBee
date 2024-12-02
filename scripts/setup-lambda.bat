@echo off
setlocal enabledelayedexpansion

REM Load environment variables from .env.lambda file
if not exist .env.lambda (
    echo Error: .env.lambda file not found
    exit /b 1
)

REM Parse .env.lambda file, skipping comments and empty lines
for /f "usebackq tokens=1,* delims==" %%a in (".env.lambda") do (
    set "line=%%a"
    if not "!line!"=="" if "!line:~0,1!" neq "#" (
        set "key=%%a"
        set "value=%%b"
        set "!key!=!value!"
    )
)

REM Set default values for Lambda configuration if not in .env.lambda
if not defined LAMBDA_FUNCTION_NAME set "LAMBDA_FUNCTION_NAME=audio-processor"
if not defined LAMBDA_TIMEOUT set "LAMBDA_TIMEOUT=900"
if not defined LAMBDA_MEMORY_SIZE set "LAMBDA_MEMORY_SIZE=2048"
if not defined LAMBDA_ROLE_NAME set "LAMBDA_ROLE_NAME=audio-processor-role"

REM Verify required environment variables
if not defined REDIS_URL (
    echo Error: REDIS_URL environment variable is not set in .env.lambda
    exit /b 1
)
if not defined REDIS_TOKEN (
    echo Error: REDIS_TOKEN environment variable is not set in .env.lambda
    exit /b 1
)
if not defined AWS_BUCKET_NAME (
    echo Error: AWS_BUCKET_NAME environment variable is not set in .env.lambda
    exit /b 1
)
if not defined AWS_REGION (
    echo Error: AWS_REGION environment variable is not set in .env.lambda
    exit /b 1
)

REM Get AWS account ID
for /f "tokens=* usebackq" %%a in (`aws sts get-caller-identity --query "Account" --output text`) do (
    set AWS_ACCOUNT_ID=%%a
)

if not defined AWS_ACCOUNT_ID (
    echo Error: Could not get AWS account ID. Please check your AWS credentials.
    exit /b 1
)

REM Create deployment package directory
if exist deployment-package rmdir /s /q deployment-package
mkdir deployment-package
cd deployment-package

REM Copy Lambda function code
xcopy /E /I ..\src\lambda\audio-processor .

REM Install production dependencies
call npm install --production

REM Create zip file
powershell Compress-Archive -Path * -DestinationPath function.zip -Force

REM Get the latest Python layer version ARN
aws lambda list-layer-versions --layer-name audio-processor-python --query "max_by(LayerVersions, &Version).LayerVersionArn" --output text > layer_arn.txt
set /p PYTHON_LAYER_ARN=<layer_arn.txt
del layer_arn.txt

if not defined PYTHON_LAYER_ARN (
    echo Error: Could not find Python layer. Please run setup-python-layer.bat first.
    cd ..
    rmdir /s /q deployment-package
    exit /b 1
)

REM Set full role ARN
set "LAMBDA_ROLE_ARN=arn:aws:iam::%AWS_ACCOUNT_ID%:role/%LAMBDA_ROLE_NAME%"

REM Delete existing function if it exists
aws lambda delete-function --function-name %LAMBDA_FUNCTION_NAME% 2>nul

REM Create environment variables JSON using PowerShell
powershell -Command "$env = @{ Variables = @{ REDIS_URL='%REDIS_URL%'; REDIS_TOKEN='%REDIS_TOKEN%'; AWS_BUCKET_NAME='%AWS_BUCKET_NAME%' } }; $json = ConvertTo-Json $env -Compress; Set-Content -Path env.json -Value $json"

REM Create new Lambda function using environment variables from JSON file
aws lambda create-function ^
    --function-name %LAMBDA_FUNCTION_NAME% ^
    --runtime nodejs18.x ^
    --handler index.handler ^
    --role !LAMBDA_ROLE_ARN! ^
    --timeout %LAMBDA_TIMEOUT% ^
    --memory-size %LAMBDA_MEMORY_SIZE% ^
    --layers !PYTHON_LAYER_ARN! ^
    --zip-file fileb://function.zip ^
    --environment file://env.json

if errorlevel 1 (
    echo Error: Failed to create Lambda function
    cd ..
    rmdir /s /q deployment-package
    exit /b 1
)

REM Clean up
cd ..
rmdir /s /q deployment-package

echo Lambda setup complete
exit /b 0
