// Minimum duration for typing indicator in milliseconds
export const MIN_TYPING_DURATION = 1500

// Maximum duration for typing indicator in milliseconds
export const MAX_TYPING_DURATION = 3000

// Calculate typing duration based on message length
export const getTypingDuration = (message: string): number => {
  // Average typing speed (characters per minute)
  const TYPING_SPEED = 300
  
  // Calculate base duration from message length
  const baseDuration = (message.length / TYPING_SPEED) * 60 * 1000
  
  // Ensure duration is within bounds
  return Math.min(
    Math.max(baseDuration, MIN_TYPING_DURATION),
    MAX_TYPING_DURATION
  )
}

// Add random variation to typing duration
export const getRandomTypingDuration = (message: string): number => {
  const baseDuration = getTypingDuration(message)
  const variation = baseDuration * 0.2 // 20% variation
  const randomOffset = Math.random() * variation - (variation / 2)
  return Math.round(baseDuration + randomOffset)
}

// Simulate natural typing delay
export const simulateTypingDelay = async (message: string): Promise<void> => {
  const duration = getRandomTypingDuration(message)
  await new Promise(resolve => setTimeout(resolve, duration))
}
