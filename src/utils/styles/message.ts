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
    ${isAssistant ? 'mb-2' : 'mb-4'}
    first:mt-4
    last:mb-6
  `,
  wrapper: (isAssistant: boolean) => `
    flex items-end gap-3
    ${isAssistant ? 'flex-row' : 'flex-row-reverse'}
    group
    relative
    ${isAssistant ? 'ml-2' : 'mr-2'}
  `,
  avatar: (isAssistant: boolean) => `
    w-8 h-8 rounded-full flex-shrink-0
    ${isAssistant 
      ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
      : 'bg-gradient-to-br from-indigo-500 to-purple-600'}
    flex items-center justify-center
    text-white text-sm font-medium
    shadow-lg
    transform-gpu translate-y-0
    transition-all duration-200
    group-hover:-translate-y-0.5
    group-hover:shadow-xl
    select-none
    ring-2 ring-white
  `,
  bubble: (isAssistant: boolean) => `
    p-4 rounded-2xl max-w-[85%]
    ${isAssistant 
      ? 'bg-white shadow-md rounded-bl-sm border border-gray-100/80' 
      : 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm shadow-md'}
    transition-all duration-200
    hover:shadow-lg
    backdrop-blur-sm
    ${isAssistant ? 'bg-white/95' : 'from-indigo-500/95 to-indigo-600/95'}
    transform-gpu translate-y-0
    group-hover:-translate-y-0.5
    leading-relaxed
    text-[15px]
  `
}
