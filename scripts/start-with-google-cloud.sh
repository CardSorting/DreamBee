#!/bin/bash
export GOOGLE_APPLICATION_CREDENTIALS="$(dirname "$0")/../credentials/google-cloud.json"
npm run dev
