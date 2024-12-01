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

echo Updating IAM role policy...

:: Create inline policy
aws iam put-role-policy ^
    --role-name audio-processor-role ^
    --policy-name audio-processor-permissions ^
    --policy-document file://docs/role-policy.json

if errorlevel 1 (
    echo Error: Failed to update role policy
    exit /b 1
)

echo Role policy updated successfully!
