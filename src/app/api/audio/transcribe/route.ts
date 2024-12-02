import { NextRequest, NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

interface AssemblyAIWord {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
}

interface AssemblyAIUtterance {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
  words?: AssemblyAIWord[]
}

interface AssemblyAITranscript {
  text: string
  status: string
  error?: string
  utterances?: AssemblyAIUtterance[]
  words?: AssemblyAIWord[]
  speaker_labels?: boolean
  speakers_expected?: number
  confidence: number
  speakers?: string[]
}

interface EnhancedTranscript extends AssemblyAITranscript {
  speakers: string[]
}

export async function POST(req: NextRequest) {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    const { audioUrl, options, speakerNames } = await req.json()

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      )
    }

    const client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    })

    // Submit transcription request
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      speaker_labels: options?.speakerDetection,
      word_boost: ["*"],
      language_code: "en_us" // Set language to US English
    }) as AssemblyAITranscript

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed')
    }

    let enhancedTranscript: EnhancedTranscript = {
      ...transcript,
      speakers: transcript.speakers || []
    }

    // Map speaker labels to character names
    if (enhancedTranscript.utterances && speakerNames) {
      const speakerMap = new Map<string, string>()
      
      // Create mapping of AssemblyAI speaker labels to character names
      enhancedTranscript.utterances.forEach((utterance) => {
        if (utterance.speaker && !speakerMap.has(utterance.speaker)) {
          // Map each unique speaker to a character name
          const characterIndex = speakerMap.size
          if (characterIndex < speakerNames.length) {
            speakerMap.set(utterance.speaker, speakerNames[characterIndex])
          }
        }
      })

      // Replace speaker labels with character names
      enhancedTranscript.utterances = enhancedTranscript.utterances.map((utterance) => ({
        ...utterance,
        speaker: utterance.speaker ? speakerMap.get(utterance.speaker) || utterance.speaker : null,
        words: utterance.words?.map((word) => ({
          ...word,
          speaker: word.speaker ? speakerMap.get(word.speaker) || word.speaker : null
        }))
      }))

      // Update speakers array with character names
      enhancedTranscript.speakers = Array.from(speakerMap.values())
    }

    return NextResponse.json(enhancedTranscript)

  } catch (error: any) {
    console.error('Transcription failed:', error)
    
    let errorMessage = 'Failed to transcribe audio'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
