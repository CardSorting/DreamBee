import { Anthropic } from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

interface ContentBlock {
  type: 'text'
  text: string
}

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

    // Convert messages to Anthropic format
    const anthropicMessages = recentMessages.map((msg: Message) => {
      if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
        console.error('Invalid message format:', msg)
        throw new Error(`Invalid message format: ${JSON.stringify(msg)}`)
      }

      return {
        role: msg.role,
        content: msg.content
      }
    })

    // Log formatted messages
    console.log('Formatted messages for Anthropic:', anthropicMessages)

    // Ensure there's at least one message
    if (anthropicMessages.length === 0) {
      throw new Error('No valid messages provided')
    }

    if (!stream) {
      // For non-streaming responses
      console.log('Making non-streaming request to Anthropic')
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        temperature: 0.7,
        messages: anthropicMessages,
        system: "You are a helpful AI assistant. Provide clear, accurate, and engaging responses."
      })

      // Log full response for debugging
      console.log('Full Anthropic response:', JSON.stringify(response, null, 2))

      // Extract text content from response blocks
      const textContent = response.content
        .filter((block): block is { type: 'text'; text: string } => 
          block.type === 'text' && typeof block.text === 'string'
        )
        .map(block => block.text)
        .join('\n')

      console.log('Extracted text content:', textContent)

      if (!textContent) {
        console.error('No text content found in response:', response)
        throw new Error('No text content in response')
      }

      // Log final response
      console.log('Sending response:', { contentLength: textContent.length, content: textContent })

      return NextResponse.json({ content: textContent })
    } else {
      // For streaming responses
      console.log('Making streaming request to Anthropic')
      const stream = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        temperature: 0.7,
        messages: anthropicMessages,
        system: "You are a helpful AI assistant. Provide clear, accurate, and engaging responses.",
        stream: true
      })

      const encoder = new TextEncoder()
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            let chunkCount = 0
            for await (const chunk of stream) {
              console.log('Stream chunk:', JSON.stringify(chunk, null, 2))
              
              if (chunk.type === 'message_delta' && chunk.delta) {
                const deltaContent = 'content' in chunk.delta ? chunk.delta.content : null
                if (Array.isArray(deltaContent)) {
                  deltaContent.forEach(block => {
                    if ('type' in block && block.type === 'text' && 'text' in block) {
                      const eventData = `data: ${JSON.stringify({ content: block.text })}\n\n`
                      controller.enqueue(encoder.encode(eventData))
                      chunkCount++
                    }
                  })
                }
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
