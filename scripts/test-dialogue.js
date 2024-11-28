require('dotenv').config({ path: '.env.local' });
const { elevenLabs } = require('./elevenlabs-utils');
const { s3Service } = require('./s3-utils');
const { generateSRT, generateVTT } = require('./subtitle-utils');
const { ConversationFlowManager } = require('./conversation-flow');
const { audioAssembler } = require('./audio-utils');
const { redisService } = require('./redis-utils');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Define speakers with correct voice IDs
const speakers = [
  {
    name: "Adam",
    voiceId: "iP95p4xoKVk53GoZ742B", // Adam voice
    settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 1.0,
      use_speaker_boost: true
    }
  },
  {
    name: "Sarah",
    voiceId: "QjM5buxkKa6GRdqwjHB1", // Sarah voice
    settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 1.0,
      use_speaker_boost: true
    }
  }
];

// Test conversation with natural pauses and emphasis
const testConversation = `
[adam] I can't believe what just happened! <break time="0.3s"/> Did you see that amazing sunset?
[sarah] Yes... <break time="0.5s"/> The colors were absolutely breathtaking.
[adam] And look at those clouds! <break time="0.2s"/> They're glowing like fire in the sky!
[sarah] Nature can be so beautiful <break time="0.3s"/> it leaves you speechless.
`;

async function testDialogueGeneration() {
  try {
    console.log('Starting dialogue generation test...\n');

    // Initialize conversation flow manager
    const flowManager = new ConversationFlowManager(process.env.ANTHROPIC_API_KEY);
    
    // Parse conversation
    console.log('Parsing conversation...');
    const lines = testConversation
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/\[(\w+)\]\s*(.+)/);
        if (!match) {
          throw new Error(`Invalid line format: ${line}`);
        }
        return {
          speaker: match[1].toLowerCase(),
          text: match[2]
        };
      });

    console.log('✅ Conversation parsed successfully');
    console.log(`Found ${lines.length} dialogue turns\n`);

    // Generate a unique conversation ID
    const conversationId = 'test-' + Date.now();

    // Check Redis for existing conversation
    console.log('Checking Redis cache...');
    const existingConversation = await redisService.getConversation(conversationId);
    if (existingConversation) {
      console.log('Found existing conversation in cache');
      return existingConversation;
    }

    // Step 1: Generate audio with natural timing and emotion
    console.log('Step 1: Generating audio with natural timing and emotion...');
    const audioSegments = [];
    let currentTime = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const speaker = speakers.find(s => s.name.toLowerCase() === line.speaker);
      if (!speaker) {
        throw new Error(`Speaker not found: ${line.speaker}`);
      }
      
      console.log(`\nProcessing line for ${speaker.name} (Voice ID: ${speaker.voiceId})`);
      
      // Analyze conversation flow
      const flowAnalysis = await flowManager.analyzeTurn(line.text, {
        speaker: line.speaker,
        previousLine: i > 0 ? lines[i-1].text : null,
        nextLine: i < lines.length - 1 ? lines[i+1].text : null,
        speakerChange: i > 0 && lines[i-1].speaker !== line.speaker,
        currentLine: line.text
      });

      // Apply pre-pause
      currentTime += flowAnalysis.timing.prePause;

      // Generate speech with emotional formatting
      console.log(`\nGenerating line ${i + 1}/${lines.length} for ${speaker.name}`);
      console.log(`Starting at ${currentTime}s`);
      
      const segment = await elevenLabs.generateSpeech(
        line.text, 
        speaker, 
        currentTime,
        flowAnalysis
      );
      
      // Adjust timing based on flow analysis
      segment.startTime = currentTime;
      segment.endTime = currentTime + (segment.endTime - segment.startTime);
      currentTime = segment.endTime;

      // Apply post-pause
      currentTime += flowAnalysis.timing.postPause;

      audioSegments.push(segment);
      
      console.log(`Line ${i + 1} generated successfully`);
      console.log(`Next line will start at ${currentTime}s`);
    }

    console.log('\n✅ Audio generation successful');
    
    // Generate transcript
    console.log('\nGenerating transcript...');
    const transcript = {
      metadata: {
        duration: Math.max(...audioSegments.map(s => s.endTime)),
        speakers: [...new Set(lines.map(l => l.speaker.toLowerCase()))],
        turnCount: lines.length
      },
      turns: audioSegments.map((segment, i) => ({
        speaker: lines[i].speaker,
        text: segment.text, // Use clean text from segment
        startTime: segment.startTime,
        endTime: segment.endTime
      }))
    };
    
    // Log transcript information
    console.log('\nTranscript Overview:');
    console.log(`Total Duration: ${transcript.metadata.duration.toFixed(2)}s`);
    console.log(`Speakers: ${transcript.metadata.speakers.join(', ')}`);
    console.log(`Turn Count: ${transcript.metadata.turnCount}`);
    
    // Generate speaker timelines
    console.log('\nSpeaker Timelines:');
    for (const speaker of speakers) {
      const speakerTurns = transcript.turns.filter(t => 
        t.speaker.toLowerCase() === speaker.name.toLowerCase()
      );
      
      console.log(`\nTimeline for ${speaker.name}:\n`);
      speakerTurns.forEach(turn => {
        console.log(`[${formatTime(turn.startTime)} - ${formatTime(turn.endTime)}]`);
        console.log(`Text: ${turn.text}\n`);
      });

      const totalTime = speakerTurns.reduce((sum, turn) => 
        sum + (turn.endTime - turn.startTime), 0
      );
      const wordCount = speakerTurns.reduce((sum, turn) => 
        sum + turn.text.split(/\s+/).length, 0
      );

      console.log('\nSummary:');
      console.log(`Total speaking time: ${formatTime(totalTime)}`);
      console.log(`Word count: ${wordCount}`);
      console.log(`Average words per turn: ${(wordCount / speakerTurns.length).toFixed(1)}`);
    }

    // Generate subtitles
    console.log('\nGenerating subtitles...');
    const srtContent = generateSRT(audioSegments);
    const vttContent = generateVTT(audioSegments);

    // Step 2: Upload to S3
    console.log('\nStep 2: Uploading files to S3...');

    // Upload audio files
    const audioUploads = await s3Service.uploadMultipleAudio(
      audioSegments.map(({ character, audio }) => ({ character, audio })),
      conversationId
    );
    console.log('✅ Audio files uploaded successfully');

    // Upload transcript and subtitle files
    const transcriptKey = `conversations/${conversationId}/transcript.json`;
    const srtKey = `conversations/${conversationId}/subtitles.srt`;
    const vttKey = `conversations/${conversationId}/subtitles.vtt`;

    // Also upload individual speaker transcripts
    const speakerTranscriptKeys = await Promise.all(
      speakers.map(async speaker => {
        const speakerTurns = transcript.turns.filter(t => 
          t.speaker.toLowerCase() === speaker.name.toLowerCase()
        );
        const content = speakerTurns.map(turn => 
          `[${formatTime(turn.startTime)} - ${formatTime(turn.endTime)}]\n${turn.text}\n`
        ).join('\n');
        
        const key = `conversations/${conversationId}/speakers/${speaker.name.toLowerCase()}.txt`;
        await s3Service.uploadFile(key, content, 'text/plain');
        return { speaker: speaker.name, key };
      })
    );

    await Promise.all([
      s3Service.uploadFile(transcriptKey, JSON.stringify(transcript, null, 2), 'application/json'),
      s3Service.uploadFile(srtKey, srtContent, 'text/plain'),
      s3Service.uploadFile(vttKey, vttContent, 'text/plain')
    ]);
    console.log('✅ Transcript and subtitle files uploaded successfully');

    // Step 3: Cache in Redis
    console.log('\nStep 3: Caching in Redis...');
    await redisService.cacheConversation({
      conversationId,
      audioSegments: audioSegments.map((segment, index) => ({
        character: segment.character.name,
        audioKey: audioUploads[index].audioKey,
        timestamps: segment.timestamps,
        startTime: segment.startTime,
        endTime: segment.endTime
      })),
      transcript: {
        srt: srtContent,
        vtt: vttContent,
        json: transcript
      },
      metadata: {
        totalDuration: transcript.metadata.duration,
        speakers: transcript.metadata.speakers,
        turnCount: transcript.metadata.turnCount,
        createdAt: Date.now()
      }
    });
    console.log('✅ Conversation cached successfully');

    // Step 4: Generate URLs
    console.log('\nStep 4: Generating access URLs...');
    const urls = await Promise.all([
      ...audioUploads.map(async ({ character, audioKey }) => ({
        type: 'audio',
        character,
        signedUrl: await s3Service.getSignedUrl(audioKey),
        directUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${audioKey}`
      })),
      {
        type: 'transcript',
        signedUrl: await s3Service.getSignedUrl(transcriptKey),
        directUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${transcriptKey}`
      },
      {
        type: 'srt',
        signedUrl: await s3Service.getSignedUrl(srtKey),
        directUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${srtKey}`
      },
      {
        type: 'vtt',
        signedUrl: await s3Service.getSignedUrl(vttKey),
        directUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${vttKey}`
      },
      ...speakerTranscriptKeys.map(async ({ speaker, key }) => ({
        type: 'speaker-transcript',
        speaker,
        signedUrl: await s3Service.getSignedUrl(key),
        directUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
      }))
    ]);
    console.log('✅ URLs generated successfully\n');

    // Step 5: Assemble podcast
    console.log('Step 5: Assembling podcast...');
    const segments = audioSegments.map((segment, index) => ({
      url: urls[index].directUrl,
      startTime: segment.startTime,
      endTime: segment.endTime,
      speaker: segment.character.name
    }));

    const outputPath = path.join(os.tmpdir(), `${conversationId}_combined.mp3`);
    await audioAssembler.concatenateAudioFiles(segments, outputPath);

    // Upload combined audio
    const combinedKey = `conversations/${conversationId}/podcast_combined.mp3`;
    const combinedAudio = await fs.readFile(outputPath);
    await s3Service.uploadFile(combinedKey, combinedAudio, 'audio/mpeg');
    console.log('✅ Combined audio uploaded successfully');

    // Clean up temp file
    await fs.unlink(outputPath);

    const podcastUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${combinedKey}`;
    console.log('\nPodcast URL:', podcastUrl);

    // Display results
    console.log('\nTest Results:');
    urls.forEach(url => {
      if (url.type === 'audio') {
        console.log(`\nAudio for ${url.character}:`);
      } else if (url.type === 'speaker-transcript') {
        console.log(`\nTranscript for ${url.speaker}:`);
      } else {
        console.log(`\n${url.type.toUpperCase()} file:`);
      }
      console.log(`Signed URL: ${url.signedUrl}`);
      console.log(`Direct URL: ${url.directUrl}`);
    });

    // Save local copies for testing
    const outputDir = './test-output';
    await fs.mkdir(outputDir, { recursive: true });
    
    await Promise.all([
      fs.writeFile(`${outputDir}/transcript.json`, JSON.stringify(transcript, null, 2)),
      fs.writeFile(`${outputDir}/subtitles.srt`, srtContent),
      fs.writeFile(`${outputDir}/subtitles.vtt`, vttContent),
      ...speakers.map(speaker => {
        const speakerTurns = transcript.turns.filter(t => 
          t.speaker.toLowerCase() === speaker.name.toLowerCase()
        );
        const content = speakerTurns.map(turn => 
          `[${formatTime(turn.startTime)} - ${formatTime(turn.endTime)}]\n${turn.text}\n`
        ).join('\n');
        
        return fs.writeFile(
          `${outputDir}/${speaker.name.toLowerCase()}_timeline.txt`,
          content
        );
      })
    ]);
    console.log('\n✅ Local copies saved to test-output directory');

    const shouldKeep = await question('\nWould you like to keep the test files? (y/n): ');
    
    if (shouldKeep.toLowerCase() !== 'y') {
      console.log('\nCleaning up test files...');
      const keys = [
        ...audioUploads.map(u => u.audioKey),
        transcriptKey,
        srtKey,
        vttKey,
        ...speakerTranscriptKeys.map(k => k.key),
        combinedKey
      ];
      await Promise.all([
        ...keys.map(key => s3Service.deleteFile(key)),
        redisService.deleteConversation(conversationId)
      ]);
      console.log('✅ Test files and cache deleted');
    } else {
      console.log('\nTest files have been kept for further testing.');
      console.log('You can access them using the URLs above.');
      console.log('\nFinal podcast URL:', podcastUrl);
      
      // List recent conversations in Redis
      const conversations = await redisService.listConversations();
      console.log('\nRecent conversations in Redis:');
      for (const id of conversations) {
        const data = await redisService.getConversation(id);
        console.log(`- ${id}: ${data.metadata.speakers.join(', ')} (${data.metadata.turnCount} turns)`);
      }
    }

    // Return the final result
    return {
      conversationId,
      transcript,
      urls,
      podcastUrl,
      metadata: {
        duration: transcript.metadata.duration,
        speakers: transcript.metadata.speakers,
        turnCount: transcript.metadata.turnCount
      }
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

testDialogueGeneration().catch(console.error);
