export const messageStyles = {
  container: (isAssistant: boolean) => `
    flex flex-col max-w-2xl mx-auto
    ${isAssistant ? 'items-start' : 'items-end'}
    transform-gpu scale-100 opacity-100
    transition-all duration-200 ease-out
    hover:scale-[1.01]
    animate-fadeIn
    py-2
    relative
  `,
  wrapper: (isAssistant: boolean) => `
    flex items-end gap-2
    ${isAssistant ? 'flex-row' : 'flex-row-reverse'}
    group
    relative
  `,
  avatar: (isAssistant: boolean) => `
    w-8 h-8 rounded-full flex-shrink-0
    ${isAssistant 
      ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
      : 'bg-gradient-to-br from-indigo-500 to-purple-600'}
    flex items-center justify-center
    text-white text-sm font-medium
    shadow-md
    transform-gpu translate-y-0
    transition-all duration-200
    group-hover:-translate-y-0.5
    select-none
  `,
  bubble: (isAssistant: boolean) => `
    p-3 rounded-2xl max-w-[85%]
    ${isAssistant 
      ? 'bg-white shadow-sm rounded-bl-sm border border-gray-100/80' 
      : 'bg-indigo-600 text-white rounded-br-sm shadow-sm'}
    transition-all duration-200
    hover:shadow-md
    backdrop-blur-sm
    ${isAssistant ? 'bg-white/95' : 'bg-indigo-600/95'}
    transform-gpu translate-y-0
    group-hover:-translate-y-0.5
    mb-4
  `,
  timestamp: `
    text-[10px] text-gray-400
    opacity-0 group-hover:opacity-100
    transition-opacity duration-200
    select-none
    font-medium
    absolute
    bottom-1
    left-2
  `
}
