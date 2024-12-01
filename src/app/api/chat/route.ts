import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    maxOutputTokens: 1024,
    temperature: 0.7,
  }
})

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export async function POST(request: Request) {
  try {
    const { messages, stream } = await request.json()

    // Log incoming request
    console.log('Received request:', { messageCount: messages?.length, stream })

    // Validate messages array
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array')
    }

    // Take only the last 10 messages to stay within context limits
    const recentMessages = messages.slice(-10)
    console.log('Using recent messages:', recentMessages)

    // Convert messages to Gemini format
    const geminiMessages = recentMessages.map((msg: Message) => {
      if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
        console.error('Invalid message format:', msg)
        throw new Error(`Invalid message format: ${JSON.stringify(msg)}`)
      }

      return {
        role: msg.role,
        parts: [{ text: msg.content }]
      }
    })

    // Log formatted messages
    console.log('Formatted messages for Gemini:', geminiMessages)

    // Ensure there's at least one message
    if (geminiMessages.length === 0) {
      throw new Error('No valid messages provided')
    }

    // Start a chat
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1), // All messages except the last one
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    })

    const lastMessage = geminiMessages[geminiMessages.length - 1]

    if (!stream) {
      // For non-streaming responses
      console.log('Making non-streaming request to Gemini')
      const result = await chat.sendMessage(lastMessage.parts[0].text)
      const response = result.response.text()

      console.log('Extracted text content:', response)

      if (!response) {
        console.error('No text content found in response')
        throw new Error('No text content in response')
      }

      // Log final response
      console.log('Sending response:', { contentLength: response.length, content: response })

      return NextResponse.json({ content: response })
    } else {
      // For streaming responses
      console.log('Making streaming request to Gemini')
      const result = await chat.sendMessageStream(lastMessage.parts[0].text)

      const encoder = new TextEncoder()
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            let chunkCount = 0
            for await (const chunk of result.stream) {
              const chunkText = chunk.text()
              console.log('Stream chunk:', chunkText)
              
              if (chunkText) {
                const eventData = `data: ${JSON.stringify({ content: chunkText })}\n\n`
                controller.enqueue(encoder.encode(eventData))
                chunkCount++
              }
            }
            console.log(`Streaming completed. Sent ${chunkCount} chunks`)
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            console.error('Streaming error:', error)
            controller.error(error)
          }
        }
      })

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }
  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process chat request', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
