import fetch from 'node-fetch';
import { Genre } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIALOGUE_ID = 'test-dialogue-123';
const BASE_URL = 'http://localhost:3000';

interface ErrorResponse {
  error: string;
}

async function checkServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL);
    return response.status !== 404; // Next.js returns 404 for root but server is running
  } catch (error) {
    return false;
  }
}

async function getClerkToken(): Promise<string | null> {
  // For now, return null. We'll implement this later
  return null;
}

async function testPublishDialogue() {
  try {
    // Check if server is running
    console.log('Checking if development server is running...');
    const isServerRunning = await checkServerRunning();
    if (!isServerRunning) {
      throw new Error(`Server is not running at ${BASE_URL}. Please start the development server with 'npm run dev'`);
    }
    console.log('Server is running ✓');

    // Get auth token
    console.log('Checking authentication...');
    const token = await getClerkToken();
    if (!token) {
      console.warn('⚠️ No authentication token found. Request may fail if authentication is required.');
    } else {
      console.log('Authentication token found ✓');
    }

    const publishData = {
      title: "Test Dialogue",
      genre: Genre.COMEDY,
      description: "A test dialogue between Alice and Bob",
      hashtags: ["#test", "#dialogue"],
      audioUrl: "https://example.com/test-audio.mp3",
      metadata: {
        totalDuration: 120, // 2 minutes
        speakers: ["Alice", "Bob"],
        turnCount: 4,
        createdAt: Date.now(),
        completedChunks: 1,
        totalChunks: 1,
        audioUrls: [{ url: "https://example.com/test-audio.mp3" }],
        transcript: "Alice: Hello!\nBob: Hi there!\nAlice: How are you?\nBob: I'm great!"
      }
    };

    console.log('Publishing test dialogue...');
    console.log('Request URL:', `${BASE_URL}/api/dialogues/${TEST_DIALOGUE_ID}/publish`);
    console.log('Request Data:', JSON.stringify(publishData, null, 2));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/api/dialogues/${TEST_DIALOGUE_ID}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify(publishData),
    });

    if (!response.ok) {
      let errorMessage = `Server returned ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json() as ErrorResponse;
        errorMessage += `: ${errorData.error}`;
      } catch {
        // If we can't parse the error JSON, just use the status message
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Successfully published dialogue:', result);

  } catch (error) {
    if (error instanceof Error) {
      console.error('\n❌ Error in test script:', error.message);
    } else {
      console.error('\n❌ Unknown error in test script');
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting publish dialogue test...\n');
testPublishDialogue();
