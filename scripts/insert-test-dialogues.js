require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb')

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

const docClient = DynamoDBDocumentClient.from(client)

async function insertTestDialogues() {
  try {
    console.log('Inserting test dialogues...')
    
    const timestamp = new Date().toISOString()
    const testDialogues = [
      {
        type: 'PUBLISHED_DIALOGUE',
        pk: 'GENRE#Comedy',
        sk: `DIALOGUE#test1_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        genre: 'Comedy',
        dialogueId: `test1_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: 'Funny Conversation',
        description: 'A hilarious dialogue between friends',
        createdAt: timestamp,
        updatedAt: timestamp,
        userId: 'test-user',
        audioUrl: 'https://example.com/audio1.mp3',
        likes: 10,
        dislikes: 2,
        favorites: 5,
        hashtags: ['funny', 'comedy'],
        comments: [],
        reactions: {},
        metadata: {
          totalDuration: 120, // 2 minutes
          speakers: ['John', 'Sarah'],
          turnCount: 4,
          createdAt: Date.now()
        },
        dialogue: [
          {
            character: 'John',
            text: 'Hey, did you hear about the new restaurant?'
          },
          {
            character: 'Sarah',
            text: 'No, what\'s special about it?'
          },
          {
            character: 'John',
            text: 'They serve food in complete darkness!'
          },
          {
            character: 'Sarah',
            text: 'How do they expect us to Instagram our food then? 😄'
          }
        ]
      },
      {
        type: 'PUBLISHED_DIALOGUE',
        pk: 'GENRE#Drama',
        sk: `DIALOGUE#test2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        genre: 'Drama',
        dialogueId: `test2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: 'Dramatic Scene',
        description: 'An intense dramatic dialogue',
        createdAt: timestamp,
        updatedAt: timestamp,
        userId: 'test-user',
        audioUrl: 'https://example.com/audio2.mp3',
        likes: 15,
        dislikes: 1,
        favorites: 8,
        hashtags: ['drama', 'intense'],
        comments: [],
        reactions: {},
        metadata: {
          totalDuration: 180, // 3 minutes
          speakers: ['Michael', 'Emma'],
          turnCount: 4,
          createdAt: Date.now()
        },
        dialogue: [
          {
            character: 'Michael',
            text: 'I can\'t believe you\'re leaving...'
          },
          {
            character: 'Emma',
            text: 'I have to follow my dreams, Michael.'
          },
          {
            character: 'Michael',
            text: 'But what about our dreams? Everything we planned?'
          },
          {
            character: 'Emma',
            text: 'Sometimes life takes us in different directions.'
          }
        ]
      }
    ]

    for (const dialogue of testDialogues) {
      await docClient.send(new PutCommand({
        TableName: 'PublishedDialogues',
        Item: dialogue
      }))
      console.log(`Inserted dialogue: ${dialogue.title}`)
    }

    console.log('Test dialogues inserted successfully')
  } catch (error) {
    console.error('Error inserting test dialogues:', error)
  }
}

insertTestDialogues()
