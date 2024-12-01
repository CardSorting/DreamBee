@echo off
echo Installing dependencies...
npm install @aws-sdk/client-iam

echo Running user creation script...
node scripts/create-lambda-user.js

if errorlevel 1 (
    echo Error creating Lambda user
    exit /b 1
)

echo Running Lambda setup...
scripts\setup-lambda.bat
