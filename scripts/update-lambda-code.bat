@echo off
setlocal enabledelayedexpansion

:: Read and set environment variables from .env.lambda
for /f "usebackq tokens=1,* delims==" %%a in (".env.lambda") do (
    if not "%%a"=="" if not "%%b"=="" (
        set "%%a=%%b"
    )
)

:: Set AWS CLI environment variables
set AWS_DEFAULT_REGION=%AWS_REGION%

echo Updating Lambda function code...

:: Create temporary directory
set TEMP_DIR=%TEMP%\lambda-code-update
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" || exit /b 1

:: Install Lambda function dependencies
echo Installing Lambda function dependencies...
cd "%~dp0..\src\lambda\audio-processor"
call npm install
if errorlevel 1 (
    echo Error installing Lambda dependencies
    exit /b 1
)

:: Package Lambda function
echo Creating Lambda function package...
powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal; [System.IO.Compression.ZipFile]::CreateFromDirectory('.', '%TEMP_DIR%\lambda-function.zip', $compressionLevel, $false) }"
cd "%TEMP_DIR%"
if errorlevel 1 (
    echo Error creating function package
    exit /b 1
)

:: Update Lambda function code
echo Updating Lambda function code...
aws lambda update-function-code ^
    --function-name "audio-processor" ^
    --zip-file fileb://lambda-function.zip

if errorlevel 1 (
    echo Error updating Lambda function code
    exit /b 1
)

echo Update completed successfully!

:: Clean up
cd "%~dp0"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"

endlocal
