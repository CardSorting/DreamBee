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

REM Clean up any existing python-layer directory
if exist python-layer rmdir /s /q python-layer

REM Create python directory for the layer
mkdir python-layer
cd python-layer
mkdir python

REM Install Python dependencies into the layer directory
python -m pip install -r ..\src\lambda\audio-processor\requirements.txt -t python --no-user --platform manylinux2014_x86_64 --implementation cp --python-version 3.9 --only-binary=:all: --upgrade

REM Create zip file for the layer
powershell -Command "Compress-Archive -Path python\* -DestinationPath python-layer.zip -Force"

REM Delete existing layer versions if they exist
aws lambda list-layer-versions --layer-name audio-processor-python --query "LayerVersions[*].Version" --output text > versions.txt
if exist versions.txt (
    for /f "tokens=*" %%v in (versions.txt) do (
        aws lambda delete-layer-version --layer-name audio-processor-python --version-number %%v
    )
    del versions.txt
)

REM Create new Lambda layer
aws lambda publish-layer-version ^
    --layer-name audio-processor-python ^
    --description "Python dependencies for audio processing" ^
    --zip-file fileb://python-layer.zip ^
    --compatible-runtimes python3.9 ^
    --compatible-architectures "x86_64"

if errorlevel 1 (
    echo Error: Failed to publish Lambda layer
    cd ..
    rmdir /s /q python-layer
    exit /b 1
)

REM Clean up
cd ..
rmdir /s /q python-layer

echo Python layer setup complete
exit /b 0
