@echo off
setlocal

if "%~1"=="" (
    echo Please provide the path to your Google Cloud credentials JSON file
    echo Usage: setup-google-cloud.bat path\to\credentials.json
    exit /b 1
)

node "%~dp0setup-google-cloud.js" "%~1"
if errorlevel 1 (
    echo Setup failed
    exit /b 1
)

echo.
echo You can now start the application with:
echo npm run dev
