import { ChatSession } from './chat-service'
import { DialogueAnalyzer } from './dialogue-analyzer'
import { ProsodyAnalyzer } from './prosody-analyzer'
import { ConversationFlowManager } from './conversation-flow'

interface DialogueLine {
  character: string
  text: string
}

interface GeneratedScript {
  title: string
  description: string
  characters: Array<{
    name: string
    voiceId: string
    description: string
  }>
  dialogue: DialogueLine[]
  genre: string
  estimatedDuration: number
}

export class ChatToDialogueAdapter {
  private static instance: ChatToDialogueAdapter
  private dialogueAnalyzer: DialogueAnalyzer
  private prosodyAnalyzer: ProsodyAnalyzer
  private flowManager: ConversationFlowManager

  private constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('Missing GOOGLE_API_KEY environment variable')
    }
    this.dialogueAnalyzer = new DialogueAnalyzer(process.env.GOOGLE_API_KEY)
    this.prosodyAnalyzer = new ProsodyAnalyzer(process.env.GOOGLE_API_KEY)
    this.flowManager = new ConversationFlowManager(process.env.GOOGLE_API_KEY)
  }

  static getInstance(): ChatToDialogueAdapter {
    if (!ChatToDialogueAdapter.instance) {
      ChatToDialogueAdapter.instance = new ChatToDialogueAdapter()
    }
    return ChatToDialogueAdapter.instance
  }

  async convertToScript(session: ChatSession): Promise<GeneratedScript> {
    // Reset flow manager for new conversion
    this.flowManager.reset()

    // Convert chat messages to dialogue format
    const dialogue: DialogueLine[] = []
    
    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i]
      const prevMsg = i > 0 ? session.messages[i - 1] : null
      const nextMsg = i < session.messages.length - 1 ? session.messages[i + 1] : null

      // Analyze flow and timing
      const flowAnalysis = await this.flowManager.analyzeTurn(
        msg.content,
        {
          speaker: msg.role === 'assistant' ? 'Adam' : 'Sarah',
          previousLine: prevMsg?.content || null,
          nextLine: nextMsg?.content || null,
          speakerChange: prevMsg ? prevMsg.role !== msg.role : false,
          currentLine: msg.content
        }
      )

      // Add line to dialogue with flow-aware timing
      dialogue.push({
        character: msg.role === 'assistant' ? 'Adam' : 'Sarah',
        text: msg.content
      })
    }

    // Create script in format expected by existing pipeline
    return {
      title: session.title,
      description: `A conversation between two people about ${session.title}`,
      characters: [
        {
          name: "Adam",
          voiceId: "pNInz6obpgDQGcFmaJgB",
          description: "Male, mid-30s, confident and articulate"
        },
        {
          name: "Sarah",
          voiceId: "21m00Tcm4TlvDq8ikWAM",
          description: "Female, late-20s, energetic and expressive"
        }
      ],
      dialogue,
      genre: "conversation",
      estimatedDuration: dialogue.length * 15 // Rough estimate of 15 seconds per line
    }
  }
}

export const chatToDialogue = ChatToDialogueAdapter.getInstance()
