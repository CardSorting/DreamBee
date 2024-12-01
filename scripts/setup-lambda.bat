@echo off
setlocal enabledelayedexpansion

:: Function to cleanup resources
if "%1"=="--cleanup" (
    call :cleanup_resources
    exit /b 0
)

:: Check if .env.lambda exists
if not exist .env.lambda (
    echo Error: .env.lambda file not found
    echo Please create .env.lambda with AWS credentials and Lambda configuration
    echo See .env.lambda.example for required variables
    exit /b 1
)

:: Read and set environment variables from .env.lambda
for /f "usebackq tokens=1,* delims==" %%a in (".env.lambda") do (
    if not "%%a"=="" if not "%%b"=="" (
        set "%%a=%%b"
    )
)

:: Configuration
set TEMP_DIR=%TEMP%\lambda-setup
set FFMPEG_URL=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
set ROLE_ARN=arn:aws:iam::590184106837:role/audio-processor-role

echo Checking environment variables...

:: Required variables
set "REQUIRED_VARS=AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY LAMBDA_FUNCTION_NAME"
for %%v in (%REQUIRED_VARS%) do (
    call :check_var %%v || exit /b 1
)

:: Set AWS CLI environment variables
set AWS_DEFAULT_REGION=%AWS_REGION%

echo Setting up AWS Lambda function for audio processing...

:: Create temporary directory
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" || (
    echo Error creating temporary directory
    exit /b 1
)
mkdir "%TEMP_DIR%\ffmpeg-layer\bin" || exit /b 1
cd "%TEMP_DIR%" || exit /b 1

:: Test AWS credentials
echo Testing AWS credentials...
aws sts get-caller-identity > nul 2>&1
if errorlevel 1 (
    echo Error: Invalid AWS credentials
    echo Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.lambda
    goto cleanup
)

:: Check if function exists
aws lambda get-function --function-name "%LAMBDA_FUNCTION_NAME%" > nul 2>&1
if not errorlevel 1 (
    choice /C YN /M "Function %LAMBDA_FUNCTION_NAME% already exists. Delete and recreate?"
    if errorlevel 2 goto cleanup
    if errorlevel 1 (
        echo Deleting existing function...
        aws lambda delete-function --function-name "%LAMBDA_FUNCTION_NAME%"
    )
)

:: Download FFmpeg
echo Downloading FFmpeg...
curl -L "%FFMPEG_URL%" -o ffmpeg.tar.xz
if errorlevel 1 (
    echo Error downloading FFmpeg
    goto cleanup
)

:: Extract FFmpeg using tar
echo Extracting FFmpeg...
tar xf ffmpeg.tar.xz
if errorlevel 1 (
    echo Error extracting FFmpeg
    goto cleanup
)

:: Copy FFmpeg binary
echo Copying FFmpeg binary...
for /d %%i in (ffmpeg-*-amd64-static) do (
    copy "%%i\ffmpeg" "ffmpeg-layer\bin\ffmpeg" > nul
    if errorlevel 1 (
        echo Error copying FFmpeg binary
        goto cleanup
    )
)

:: Create layer zip
echo Creating layer zip...
cd ffmpeg-layer || exit /b 1
powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal; [System.IO.Compression.ZipFile]::CreateFromDirectory('.', '..\ffmpeg-layer.zip', $compressionLevel, $false) }"
cd .. || exit /b 1
if errorlevel 1 (
    echo Error creating layer zip
    goto cleanup
)

:: Verify zip file exists
if not exist ffmpeg-layer.zip (
    echo Error: Failed to create ffmpeg-layer.zip
    goto cleanup
)

:: Publish FFmpeg layer
echo Publishing FFmpeg layer...
for /f "tokens=* USEBACKQ" %%F in (`aws lambda publish-layer-version --layer-name "ffmpeg-layer" --description "FFmpeg layer for audio processing" --license-info "GPL" --zip-file fileb://ffmpeg-layer.zip --compatible-runtimes nodejs18.x --query "LayerVersionArn" --output text`) do set LAYER_VERSION_ARN=%%F
if errorlevel 1 (
    echo Error publishing layer
    goto cleanup
)

:: Install Lambda function dependencies
echo Installing Lambda function dependencies...
cd "%~dp0..\src\lambda\audio-processor"
call npm install
if errorlevel 1 (
    echo Error installing Lambda dependencies
    goto cleanup
)

:: Package Lambda function
echo Creating Lambda function package...
powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal; [System.IO.Compression.ZipFile]::CreateFromDirectory('.', '%TEMP_DIR%\lambda-function.zip', $compressionLevel, $false) }"
cd "%TEMP_DIR%"
if errorlevel 1 (
    echo Error creating function package
    goto cleanup
)

:: Create Lambda function
echo Creating Lambda function...
aws lambda create-function --function-name "%LAMBDA_FUNCTION_NAME%" --runtime nodejs18.x --handler index.handler --role "%ROLE_ARN%" --layers "%LAYER_VERSION_ARN%" --timeout 30 --memory-size 512 --zip-file fileb://lambda-function.zip > function-output.json
if errorlevel 1 (
    echo Error creating Lambda function
    goto cleanup
)

echo Setup completed successfully!
echo Lambda Function created with ARN from function-output.json
echo FFmpeg Layer ARN: %LAYER_VERSION_ARN%

:cleanup
:: Clean up
cd "%~dp0"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
exit /b 0

:check_var
if not defined %1 (
    echo Error: %1 is not set in .env.lambda
    exit /b 1
)
exit /b 0

:cleanup_resources
echo Cleaning up AWS resources...
aws lambda delete-function --function-name "%LAMBDA_FUNCTION_NAME%" 2>nul
echo Cleanup complete
exit /b 0

endlocal
