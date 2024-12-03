import { Cue } from './VTTParser'

export interface SubtitleTheme {
  current: {
    background: string
    text: string
    speaker: string
  }
  next: {
    background: string
    text: string
    speaker: string
    opacity: number
  }
}

export class SubtitleStyleManager {
  private theme: SubtitleTheme

  constructor(customTheme?: Partial<SubtitleTheme>) {
    this.theme = {
      current: {
        background: 'bg-blue-50',
        text: 'text-blue-900',
        speaker: 'text-blue-600 font-medium'
      },
      next: {
        background: 'bg-gray-50',
        text: 'text-gray-700',
        speaker: 'text-gray-600 font-medium',
        opacity: 0.6
      },
      ...customTheme
    }
  }

  getSubtitleStyles(type: 'current' | 'next'): string {
    const themeStyles = this.theme[type]
    const baseStyles = [
      themeStyles.background,
      'p-4 rounded-lg transition-all duration-300 ease-in-out w-full min-h-[100px] flex flex-col'
    ]

    if (type === 'next') {
      baseStyles.push(`opacity-${this.theme.next.opacity * 100}`)
    }

    return baseStyles.join(' ')
  }

  getSpeakerStyles(type: 'current' | 'next'): string {
    return `${this.theme[type].speaker} text-sm`
  }

  getTextStyles(type: 'current' | 'next'): string {
    return `${this.theme[type].text} break-words text-base leading-relaxed flex-grow`
  }

  getContainerStyles(): string {
    return 'relative h-[400px] overflow-hidden bg-white'
  }

  getWrapperStyles(): string {
    return 'absolute inset-0 flex flex-col space-y-4 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent'
  }
}
