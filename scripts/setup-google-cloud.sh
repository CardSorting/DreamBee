#!/bin/bash

if [ -z "$1" ]; then
    echo "Please provide the path to your Google Cloud credentials JSON file"
    echo "Usage: ./setup-google-cloud.sh path/to/credentials.json"
    exit 1
fi

node "$(dirname "$0")/setup-google-cloud.js" "$1"
if [ $? -ne 0 ]; then
    echo "Setup failed"
    exit 1
fi

echo
echo "You can now start the application with:"
echo "npm run dev"
