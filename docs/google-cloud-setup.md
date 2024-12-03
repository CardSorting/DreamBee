# Setting Up Google Cloud Text-to-Speech

This guide explains how to set up Google Cloud Text-to-Speech and AssemblyAI for the project.

## Prerequisites

1. A Google Cloud account
2. A Google Cloud project with Text-to-Speech API enabled
3. A service account key file (JSON format) with Text-to-Speech permissions
4. An AssemblyAI API key for transcription services

## Getting Started

1. Enable the Text-to-Speech API:
   - Go to the [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Text-to-Speech API"
   - Click "Enable" and wait for the API to be enabled
   - **Important**: After enabling the API, wait a few minutes for the change to propagate

2. Create a service account and download credentials:
   - Go to the [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to "IAM & Admin" > "Service Accounts"
   - Create a new service account or select an existing one
   - Create a new key (JSON format) and download it
   - Make sure the service account has the "Cloud Text-to-Speech API User" role

3. Get your AssemblyAI API key:
   - Sign up at [AssemblyAI](https://www.assemblyai.com/)
   - Navigate to your dashboard
   - Copy your API key

4. Set up environment variables:
   Create or update your `.env` file with:
   ```env
   ASSEMBLYAI_API_KEY=your_api_key_here
   ```

5. Run the setup script:

### On Windows:
```batch
scripts\setup-google-cloud.bat path\to\your-credentials.json
```

### On Unix-like systems (Linux, macOS):
```bash
# Make the script executable (first time only)
chmod +x scripts/setup-google-cloud.sh

# Run the setup script
./scripts/setup-google-cloud.sh path/to/your-credentials.json
```

## What the Setup Does

The setup script will:
1. Copy your credentials file to the project's `credentials` directory
2. Update the `.env` file with the correct path to the credentials
3. Update `.gitignore` to ensure credentials aren't committed
4. Configure the project to use the credentials automatically

## Running the Application

After setup is complete, you can start the application using:

```bash
npm run dev
```

The credentials will be automatically loaded each time you start the application.

## Troubleshooting

If you encounter any issues:

1. Verify your credentials file is valid JSON and contains all required fields
2. Ensure the Text-to-Speech API is enabled in your Google Cloud project
   - Visit https://console.developers.google.com/apis/api/texttospeech.googleapis.com/overview
   - Select your project and make sure the API is enabled
   - Wait a few minutes after enabling for the change to propagate
3. Check that your service account has the necessary permissions
4. Verify the environment variables are set correctly in your `.env` file
5. For transcription issues:
   - Verify your AssemblyAI API key is correct
   - Check the AssemblyAI dashboard for API usage and status

## Security Notes

- Never commit your credentials file to version control
- Keep your service account key secure
- Restrict the service account's permissions to only what's needed
- Regularly rotate your service account keys
- Keep your AssemblyAI API key secure and never share it
