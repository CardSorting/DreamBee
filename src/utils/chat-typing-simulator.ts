// Base typing speed (characters per minute)
const BASE_TYPING_SPEED = 400

// Thinking time ranges (in milliseconds)
const THINKING_TIME = {
  MIN: 500,
  MAX: 1500
}

// Typing speed variation (percentage)
const TYPING_SPEED_VARIATION = 0.15

// Pause ranges (in milliseconds)
const PAUSE_RANGES = {
  COMMA: { MIN: 100, MAX: 300 },
  PERIOD: { MIN: 300, MAX: 600 },
  PARAGRAPH: { MIN: 500, MAX: 800 }
}

// Get random number within range
const getRandomInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

// Calculate base typing duration for a message
const getBaseTypingDuration = (message: string): number => {
  return (message.length / BASE_TYPING_SPEED) * 60 * 1000
}

// Add natural variation to typing speed
const addTypingVariation = (duration: number): number => {
  const variation = duration * TYPING_SPEED_VARIATION
  const randomOffset = Math.random() * variation - (variation / 2)
  return Math.round(duration + randomOffset)
}

// Calculate pauses for punctuation
const calculatePunctuationPauses = (message: string): number => {
  const commas = (message.match(/,/g) || []).length
  const periods = (message.match(/[.!?]/g) || []).length
  const paragraphs = (message.match(/\n\n/g) || []).length

  let totalPause = 0
  
  // Add pauses for commas
  for (let i = 0; i < commas; i++) {
    totalPause += getRandomInRange(PAUSE_RANGES.COMMA.MIN, PAUSE_RANGES.COMMA.MAX)
  }
  
  // Add pauses for periods
  for (let i = 0; i < periods; i++) {
    totalPause += getRandomInRange(PAUSE_RANGES.PERIOD.MIN, PAUSE_RANGES.PERIOD.MAX)
  }
  
  // Add pauses for paragraphs
  for (let i = 0; i < paragraphs; i++) {
    totalPause += getRandomInRange(PAUSE_RANGES.PARAGRAPH.MIN, PAUSE_RANGES.PARAGRAPH.MAX)
  }

  return totalPause
}

// Calculate thinking time based on message complexity
const getThinkingTime = (message: string): number => {
  // Base thinking time
  const baseTime = getRandomInRange(THINKING_TIME.MIN, THINKING_TIME.MAX)
  
  // Add time for message length
  const lengthFactor = Math.min(message.length / 200, 1.5)
  
  // Add time for question marks (indicating more complex responses)
  const questionCount = (message.match(/\?/g) || []).length
  const questionFactor = questionCount * 0.2
  
  return Math.round(baseTime * (1 + lengthFactor + questionFactor))
}

// Simulate natural typing behavior
export const simulateHumanTyping = async (message: string): Promise<void> => {
  // Calculate thinking time
  const thinkingTime = getThinkingTime(message)
  await new Promise(resolve => setTimeout(resolve, thinkingTime))

  // Calculate typing time with natural variation
  const baseTypingTime = getBaseTypingDuration(message)
  const typingTimeWithVariation = addTypingVariation(baseTypingTime)
  
  // Add pauses for punctuation
  const punctuationPauses = calculatePunctuationPauses(message)
  
  // Total typing duration
  const totalDuration = Math.min(typingTimeWithVariation + punctuationPauses, 2000)
  await new Promise(resolve => setTimeout(resolve, totalDuration))
}

// Get appropriate typing indicator text
export const getTypingIndicatorText = (
  elapsedTime: number,
  estimatedTime: number
): string => {
  const progress = elapsedTime / estimatedTime

  if (progress < 0.3) {
    return 'Assistant'
  } else {
    return 'Assistant'
  }
}
