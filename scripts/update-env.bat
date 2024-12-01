@echo off
setlocal enabledelayedexpansion

echo Updating .env.local with Lambda configuration...

:: Read values from .env.lambda
for /f "usebackq tokens=1,* delims==" %%a in (".env.lambda") do (
    if not "%%a"=="" if not "%%b"=="" (
        set "%%a=%%b"
    )
)

:: Create or update .env.local
(
echo # AWS Configuration
echo AWS_REGION=%AWS_REGION%
echo AWS_ACCESS_KEY_ID=%AWS_ACCESS_KEY_ID%
echo AWS_SECRET_ACCESS_KEY=%AWS_SECRET_ACCESS_KEY%
echo.
echo # Lambda Configuration
echo LAMBDA_FUNCTION_NAME=audio-processor
echo LAMBDA_ROLE_NAME=audio-processor-role
echo LAMBDA_LAYER_NAME=ffmpeg-layer
echo LAMBDA_MEMORY_SIZE=512
echo LAMBDA_TIMEOUT=30
echo.
echo # API Configuration
echo NEXT_PUBLIC_API_URL=http://localhost:3000
echo NEXT_PUBLIC_LAMBDA_ENDPOINT=/api/audio/lambda-merge
) > .env.local

echo Environment variables updated successfully!
endlocal
