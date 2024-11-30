export const typingStyles = {
  container: `
    flex flex-col max-w-2xl mx-auto items-start
    transform-gpu scale-100 opacity-100
    transition-all duration-200 ease-out
    animate-fadeIn
    py-2
  `,
  wrapper: `
    flex items-end gap-2
    flex-row
    group
  `,
  avatar: `
    w-8 h-8 rounded-full flex-shrink-0
    bg-gradient-to-br from-blue-500 to-blue-600
    flex items-center justify-center
    text-white text-sm font-medium
    shadow-md
    transform-gpu translate-y-0
    transition-all duration-200
    group-hover:-translate-y-0.5
    select-none
    animate-pulse
  `,
  bubble: `
    px-4 py-3 rounded-2xl
    bg-gray-100/80 backdrop-blur-sm
    shadow-sm rounded-bl-sm
    flex items-center
    border border-gray-200/50
    transform-gpu translate-y-0
    transition-all duration-200
    group-hover:-translate-y-0.5
    min-w-[120px]
  `,
  text: `
    text-sm text-gray-500
    select-none
  `,
  dots: `
    text-gray-400 min-w-[24px]
    font-medium
    select-none
  `
}
