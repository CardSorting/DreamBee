@echo off
setlocal enabledelayedexpansion

:: Configuration
set TEMP_DIR=%TEMP%\lambda-setup
set FFMPEG_URL=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
set ROLE_ARN=arn:aws:iam::590184106837:role/audio-processor-role

:: Read and set environment variables from .env.lambda
for /f "usebackq tokens=1,* delims==" %%a in (".env.lambda") do (
    if not "%%a"=="" if not "%%b"=="" (
        set "%%a=%%b"
    )
)

:: Set AWS CLI environment variables
set AWS_DEFAULT_REGION=%AWS_REGION%

echo Updating Lambda function...

:: Create temporary directory
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" || (
    echo Error creating temporary directory
    exit /b 1
)
mkdir "%TEMP_DIR%\ffmpeg-layer\bin" || exit /b 1
cd "%TEMP_DIR%" || exit /b 1

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

:: Update Lambda function configuration
echo Updating Lambda function configuration...
aws lambda update-function-configuration ^
    --function-name "%LAMBDA_FUNCTION_NAME%" ^
    --role "%ROLE_ARN%" ^
    --layers "%LAYER_VERSION_ARN%" ^
    --timeout 30 ^
    --memory-size 512

if errorlevel 1 (
    echo Error updating Lambda function configuration
    goto cleanup
)

:: Update Lambda function code
echo Updating Lambda function code...
aws lambda update-function-code ^
    --function-name "%LAMBDA_FUNCTION_NAME%" ^
    --zip-file fileb://lambda-function.zip

if errorlevel 1 (
    echo Error updating Lambda function code
    goto cleanup
)

echo Update completed successfully!
echo Lambda Function updated with new configuration and code
echo FFmpeg Layer ARN: %LAYER_VERSION_ARN%

:cleanup
:: Clean up
cd "%~dp0"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
exit /b 0

endlocal
