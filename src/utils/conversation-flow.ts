import { DialogueAnalyzer } from './dialogue-analyzer'
import { ProsodyAnalyzer } from './prosody-analyzer'

interface ConversationState {
  currentTopic: string | null
  emotionalMomentum: number
  turnCount: number
  speakerHistory: string[]
  lastSpeaker: string | null
  lastAnalysis: FlowAnalysis | null
}

interface FlowContext {
  speaker: string
  previousLine: string | null
  nextLine: string | null
  speakerChange: boolean
  currentLine: string
}

interface FlowTiming {
  prePause: number
  postPause: number
  pace: number
}

interface FlowSuggestions {
  flow: {
    type: 'fluid' | 'measured'
    confidence: number
  }
  emphasis: {
    points: 'strong' | 'moderate'
    pattern: {
      direction: 'rising' | 'falling' | 'flat'
      intensity?: number
    }
  }
  timing: {
    variation: 'consistent' | 'natural'
    flexibility: 'dynamic' | 'stable'
  }
}

interface FlowAnalysis {
  timing: FlowTiming
  context: {
    emotionalMomentum: number
    turnCount: number
    naturalness: number
    intonation: {
      direction: 'rising' | 'falling' | 'flat'
      intensity?: number
    }
  }
  suggestions: FlowSuggestions
}

export class ConversationFlowManager {
  private dialogueAnalyzer: DialogueAnalyzer
  private prosodyAnalyzer: ProsodyAnalyzer
  private conversationState: ConversationState
  private readonly MIN_PAUSE = 0.1 // seconds
  private readonly MAX_PAUSE = 2.0 // seconds
  private readonly MIN_PACE = 0.8
  private readonly MAX_PACE = 1.5

  constructor(anthropicApiKey: string | undefined) {
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key is required')
    }
    
    this.dialogueAnalyzer = new DialogueAnalyzer(anthropicApiKey)
    this.prosodyAnalyzer = new ProsodyAnalyzer(anthropicApiKey)
    this.resetState()
  }

  private resetState() {
    this.conversationState = {
      currentTopic: null,
      emotionalMomentum: 0,
      turnCount: 0,
      speakerHistory: [],
      lastSpeaker: null,
      lastAnalysis: null
    }
  }

  private validateContext(context: FlowContext): { isValid: boolean; reason?: string } {
    if (!context.speaker || typeof context.speaker !== 'string') {
      return { isValid: false, reason: 'Speaker is required and must be a string' }
    }

    if (!context.currentLine || typeof context.currentLine !== 'string') {
      return { isValid: false, reason: 'Current line is required and must be a string' }
    }

    if (context.previousLine !== null && typeof context.previousLine !== 'string') {
      return { isValid: false, reason: 'Previous line must be null or a string' }
    }

    if (context.nextLine !== null && typeof context.nextLine !== 'string') {
      return { isValid: false, reason: 'Next line must be null or a string' }
    }

    if (typeof context.speakerChange !== 'boolean') {
      return { isValid: false, reason: 'Speaker change must be a boolean' }
    }

    return { isValid: true }
  }

  private validateAnalysis(analysis: any): { isValid: boolean; reason?: string } {
    if (!analysis || typeof analysis !== 'object') {
      return { isValid: false, reason: 'Invalid analysis object' }
    }

    if (!analysis.emotionalIntensity || typeof analysis.emotionalIntensity !== 'number') {
      return { isValid: false, reason: 'Missing or invalid emotional intensity' }
    }

    if (!analysis.naturalPauses || typeof analysis.naturalPauses !== 'object') {
      return { isValid: false, reason: 'Missing or invalid natural pauses' }
    }

    return { isValid: true }
  }

  async analyzeTurn(currentLine: string, context: FlowContext = {} as FlowContext): Promise<FlowAnalysis> {
    console.log('[ConversationFlow] Analyzing turn:', { 
      speaker: context.speaker,
      currentLine,
      turnCount: this.conversationState.turnCount + 1
    })

    // Validate context
    const contextValidation = this.validateContext(context)
    if (!contextValidation.isValid) {
      console.error('[ConversationFlow] Invalid context:', contextValidation.reason)
      throw new Error(`Invalid context: ${contextValidation.reason}`)
    }

    try {
      // Get dialogue analysis
      const dialogueAnalysis = await this.dialogueAnalyzer.analyze({
        currentLine,
        previousLine: context.previousLine,
        nextLine: context.nextLine,
        speaker: context.speaker,
        speakerChange: context.speakerChange
      })

      // Validate dialogue analysis
      const dialogueValidation = this.validateAnalysis(dialogueAnalysis)
      if (!dialogueValidation.isValid) {
        console.error('[ConversationFlow] Invalid dialogue analysis:', dialogueValidation.reason)
        throw new Error(`Invalid dialogue analysis: ${dialogueValidation.reason}`)
      }

      // Get prosody analysis
      const prosodyAnalysis = await this.prosodyAnalyzer.analyze(currentLine, {
        emotionalContext: dialogueAnalysis.emotionalIntensity,
        isSpeakerChange: context.speakerChange
      })

      // Update conversation state
      this.updateConversationState(context, dialogueAnalysis)

      // Synthesize final analysis
      const analysis = this.synthesizeAnalysis(dialogueAnalysis, prosodyAnalysis, context)

      // Store last analysis
      this.conversationState.lastAnalysis = analysis

      console.log('[ConversationFlow] Analysis complete:', {
        speaker: context.speaker,
        turnCount: this.conversationState.turnCount,
        timing: analysis.timing
      })

      return analysis
    } catch (error) {
      console.error('[ConversationFlow] Error analyzing turn:', error)
      
      // If we have a last analysis, use it as fallback with adjusted timing
      if (this.conversationState.lastAnalysis) {
        console.log('[ConversationFlow] Using fallback analysis')
        const fallbackAnalysis = {
          ...this.conversationState.lastAnalysis,
          timing: {
            prePause: context.speakerChange ? 0.8 : 0.3,
            postPause: 0.5,
            pace: 1.0
          }
        }
        return fallbackAnalysis
      }

      // If no fallback available, use safe defaults
      return {
        timing: {
          prePause: context.speakerChange ? 0.8 : 0.3,
          postPause: 0.5,
          pace: 1.0
        },
        context: {
          emotionalMomentum: 0,
          turnCount: this.conversationState.turnCount,
          naturalness: 0.5,
          intonation: {
            direction: 'flat',
            intensity: 0
          }
        },
        suggestions: {
          flow: {
            type: 'measured',
            confidence: 0.5
          },
          emphasis: {
            points: 'moderate',
            pattern: {
              direction: 'flat',
              intensity: 0
            }
          },
          timing: {
            variation: 'consistent',
            flexibility: 'stable'
          }
        }
      }
    }
  }

  private updateConversationState(context: FlowContext, analysis: any) {
    // Update speaker history
    this.conversationState.speakerHistory.push(context.speaker)
    if (this.conversationState.speakerHistory.length > 10) {
      this.conversationState.speakerHistory.shift()
    }

    // Update last speaker
    this.conversationState.lastSpeaker = context.speaker

    // Update emotional momentum
    this.updateEmotionalMomentum(analysis)

    // Increment turn count
    this.conversationState.turnCount++
  }

  private updateEmotionalMomentum(analysis: any) {
    const momentum = this.conversationState.emotionalMomentum
    const intensity = analysis.emotionalIntensity || 0

    // Decay previous momentum and add new intensity
    this.conversationState.emotionalMomentum = (momentum * 0.7) + (intensity * 0.3)
  }

  private synthesizeAnalysis(dialogueAnalysis: any, prosodyAnalysis: any, context: FlowContext): FlowAnalysis {
    const timing: FlowTiming = {
      prePause: this.adjustPrePause(prosodyAnalysis.naturalPauses.pre || 0.3, dialogueAnalysis, context),
      postPause: this.adjustPostPause(prosodyAnalysis.naturalPauses.post || 0.5, dialogueAnalysis, context),
      pace: this.adjustPace(prosodyAnalysis.suggestedPace || 1.0, dialogueAnalysis, context)
    }

    return {
      timing,
      context: {
        emotionalMomentum: this.conversationState.emotionalMomentum,
        turnCount: this.conversationState.turnCount,
        naturalness: prosodyAnalysis.naturalness || 0.5,
        intonation: prosodyAnalysis.intonation || { direction: 'flat' }
      },
      suggestions: this.generateSuggestions(dialogueAnalysis, prosodyAnalysis)
    }
  }

  private adjustPrePause(basePause: number, dialogueAnalysis: any, context: FlowContext): number {
    let pause = basePause

    // Increase pause for speaker changes
    if (context.speakerChange) {
      pause *= 1.5
    }

    // Adjust for emotional intensity
    if (dialogueAnalysis.emotionalIntensity > 0.7) {
      pause *= 0.8 // Reduce pause for high emotion
    }

    // Ensure pause is within bounds
    return Math.max(this.MIN_PAUSE, Math.min(this.MAX_PAUSE, pause))
  }

  private adjustPostPause(basePause: number, dialogueAnalysis: any, context: FlowContext): number {
    let pause = basePause

    // Increase pause for end of thought groups
    if (dialogueAnalysis.isEndOfThought) {
      pause *= 1.3
    }

    // Adjust for next speaker
    if (context.nextLine === null) {
      pause *= 1.2 // Longer pause at end of dialogue
    }

    // Ensure pause is within bounds
    return Math.max(this.MIN_PAUSE, Math.min(this.MAX_PAUSE, pause))
  }

  private adjustPace(basePace: number, dialogueAnalysis: any, context: FlowContext): number {
    let pace = basePace

    // Adjust for emotional intensity
    if (dialogueAnalysis.emotionalIntensity > 0.7) {
      pace *= 1.2 // Faster for high emotion
    } else if (dialogueAnalysis.emotionalIntensity < 0.3) {
      pace *= 0.9 // Slower for low emotion
    }

    // Ensure pace is within bounds
    return Math.max(this.MIN_PACE, Math.min(this.MAX_PACE, pace))
  }

  private generateSuggestions(dialogueAnalysis: any, prosodyAnalysis: any): FlowSuggestions {
    return {
      flow: {
        type: dialogueAnalysis.emotionalIntensity > 0.6 ? 'fluid' : 'measured',
        confidence: prosodyAnalysis.confidence || 0.5
      },
      emphasis: {
        points: dialogueAnalysis.emotionalIntensity > 0.7 ? 'strong' : 'moderate',
        pattern: prosodyAnalysis.intonation || { direction: 'flat' }
      },
      timing: {
        variation: prosodyAnalysis.timing?.variation || 'consistent',
        flexibility: prosodyAnalysis.timing?.flexibility || 'stable'
      }
    }
  }

  reset(): void {
    console.log('[ConversationFlow] Resetting conversation state')
    this.resetState()
  }
}
