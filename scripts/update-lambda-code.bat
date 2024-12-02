@echo off
setlocal enabledelayedexpansion

echo Checking AWS credentials...
echo =====================================

:: Read and set environment variables from .env.lambda
echo.
echo Loading environment variables...
echo =====================================
if not exist ".env.lambda" (
    echo Error: .env.lambda file not found
    exit /b 1
)

:: Set AWS credentials directly to handle special characters
for /f "usebackq tokens=1,* delims==" %%a in (".env.lambda") do (
    set "line=%%a"
    if "!line:~0,1!" neq "#" (
        if not "%%a"=="" if not "%%b"=="" (
            set "%%a=%%b"
        )
    )
)

:: Export AWS credentials for aws cli
set "AWS_ACCESS_KEY_ID=%AWS_ACCESS_KEY_ID%"
set "AWS_SECRET_ACCESS_KEY=%AWS_SECRET_ACCESS_KEY%"
set "AWS_DEFAULT_REGION=%AWS_REGION%"

:: Verify AWS credentials
aws sts get-caller-identity > nul 2>&1
if errorlevel 1 (
    echo Error: AWS credentials validation failed
    echo Current settings:
    echo Region: %AWS_DEFAULT_REGION%
    echo Access Key: %AWS_ACCESS_KEY_ID:~0,4%...%AWS_ACCESS_KEY_ID:~-4%
    echo Secret Key: %AWS_SECRET_ACCESS_KEY:~0,4%...%AWS_SECRET_ACCESS_KEY:~-4%
    exit /b 1
)

echo AWS credentials validated successfully

:: Create backup of current function
echo Creating backup of current function configuration...
set BACKUP_DIR=%TEMP%\lambda-backup-%DATE:~-4,4%%DATE:~-10,2%%DATE:~-7,2%
mkdir "%BACKUP_DIR%" 2>nul
aws lambda get-function --function-name "audio-processor" --query "Configuration" --output json > "%BACKUP_DIR%\config-backup.json"
if errorlevel 1 (
    echo Warning: Failed to create backup, proceeding anyway...
)

:: Create temporary directory
set TEMP_DIR=%TEMP%\lambda-code-update
if exist "%TEMP_DIR%" (
    echo Cleaning up previous temporary files...
    rd /s /q "%TEMP_DIR%"
)
echo Creating temporary directory...
mkdir "%TEMP_DIR%" || (
    echo Error: Failed to create temporary directory
    exit /b 1
)

:: Check Python layer
echo.
echo Checking Python layer...
echo =====================================
aws lambda list-layer-versions --layer-name audio-processor-python --query "max_by(LayerVersions, &Version).LayerVersionArn" --output text > layer_arn.txt
set /p PYTHON_LAYER_ARN=<layer_arn.txt
del layer_arn.txt

if not defined PYTHON_LAYER_ARN (
    echo Error: Python layer not found
    echo Please run setup-python-layer.bat first
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%"
    exit /b 1
)

:: Install Lambda function dependencies
echo.
echo Installing Lambda function dependencies...
echo =====================================
cd "%~dp0..\src\lambda\audio-processor"
echo Cleaning node_modules...
if exist "node_modules" rd /s /q "node_modules"
echo Installing production dependencies...
call npm install --production --no-optional
if errorlevel 1 (
    echo Error: Failed to install Lambda dependencies
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%"
    exit /b 1
)

:: Package Lambda function
echo.
echo Creating Lambda function package...
echo =====================================
powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal; [System.IO.Compression.ZipFile]::CreateFromDirectory('.', '%TEMP_DIR%\lambda-function.zip', $compressionLevel, $false) }"
cd "%TEMP_DIR%"
if errorlevel 1 (
    echo Error: Failed to create function package
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%"
    exit /b 1
)

:: Update Lambda function configuration
echo.
echo Updating Lambda function configuration...
echo =====================================
aws lambda update-function-configuration ^
    --function-name "audio-processor" ^
    --timeout 900 ^
    --memory-size 3072 ^
    --ephemeral-storage Size=4096 ^
    --environment "Variables={NODE_OPTIONS=--max-old-space-size=2800,TEMP_DIR=/tmp/audio-processing,REDIS_URL=%REDIS_URL%,REDIS_TOKEN=%REDIS_TOKEN%,AWS_BUCKET_NAME=%AWS_BUCKET_NAME%,MIN_AUDIO_BITRATE=128000,MIN_SAMPLE_RATE=44100,ENABLE_AUDIO_VERIFICATION=true,ENABLE_MD5_VERIFICATION=true,ENABLE_SHA256_VERIFICATION=true,MAX_COMPRESSION_RATIO=90}" ^
    --layers "%PYTHON_LAYER_ARN%" || (
    echo Error: Failed to update Lambda configuration
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%"
    exit /b 1
)

:: Wait for configuration update to complete
echo Waiting for configuration update to complete...
timeout /t 5 /nobreak > nul

:: Update Lambda function code
echo.
echo Updating Lambda function code...
echo =====================================
aws lambda update-function-code ^
    --function-name "audio-processor" ^
    --zip-file fileb://lambda-function.zip || (
    echo Error: Failed to update Lambda function code
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%"
    exit /b 1
)

:: Update concurrency
echo.
echo Configuring concurrency...
echo =====================================
aws lambda put-function-concurrency ^
    --function-name "audio-processor" ^
    --reserved-concurrent-executions 2 || (
    echo Warning: Failed to set concurrency limit
)

:: Verify the update
echo.
echo Verifying deployment...
echo =====================================
aws lambda get-function --function-name "audio-processor" || (
    echo Error: Failed to verify deployment
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%"
    exit /b 1
)

:: Wait for function to be active
echo.
echo Waiting for function to be active...
echo =====================================
:wait_loop
for /f "tokens=* usebackq" %%F in (`aws lambda get-function --function-name "audio-processor" --query "Configuration.State" --output text`) do set STATE=%%F
if not "%STATE%"=="Active" (
    echo Function state: %STATE%
    timeout /t 5 /nobreak > nul
    goto wait_loop
)

echo.
echo =====================================
echo Update completed successfully!
echo Configuration:
echo - Memory: 3072 MB
echo - Timeout: 900 seconds (15 minutes)
echo - Ephemeral Storage: 4096 MB
echo - Node Options: --max-old-space-size=2800
echo - Redis URL: %REDIS_URL:~0,20%...
echo - Redis Token: %REDIS_TOKEN:~0,8%...
echo - AWS Bucket: %AWS_BUCKET_NAME%
echo - Concurrent Executions: 2
echo - Audio Verification: Enabled
echo - MD5 Verification: Enabled
echo - SHA256 Verification: Enabled
echo - Min Audio Bitrate: 128 kbps
echo - Min Sample Rate: 44.1 kHz
echo - Max Compression Ratio: 90%%
echo - Backup Location: %BACKUP_DIR%
echo =====================================

:: Clean up
cd "%~dp0"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"

:: Create test payload file with verification data
echo Creating test payload...
echo {^
    "test": true,^
    "conversationId": "test",^
    "verifyIntegrity": true,^
    "segments": [^
        {^
            "url": "https://example.com/test.mp3",^
            "startTime": 0,^
            "endTime": 1,^
            "character": "test",^
            "expectedMd5": null,^
            "expectedSize": null,^
            "verifyQuality": true^
        }^
    ]^
} > test-payload.json

:: Verify the function works
echo.
echo Testing function with data integrity checks...
echo =====================================
aws lambda invoke ^
    --function-name "audio-processor" ^
    --payload fileb://test-payload.json ^
    response.json

if errorlevel 1 (
    echo Warning: Function test failed
    echo Please check CloudWatch logs for details
) else (
    echo Function test completed
    type response.json
)

:: Clean up test files
del test-payload.json 2>nul
del response.json 2>nul

endlocal
