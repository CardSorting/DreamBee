export const mainStyles = {
  container: `
    flex-1 flex flex-col min-w-0 h-full 
    overflow-hidden bg-white relative
  `,
  mobileHeader: `
    sticky top-0 z-20 
    flex items-center justify-between 
    p-4 bg-white/95 border-b border-gray-200 
    backdrop-blur-sm shadow-sm
  `,
  historyButton: `
    flex items-center gap-2 px-3 py-1.5 
    text-sm font-medium text-blue-600 
    bg-blue-50 hover:bg-blue-100 active:bg-blue-200 
    rounded-lg transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    transform-gpu hover:-translate-y-0.5 active:translate-y-0
  `,
  messageCount: `
    text-sm text-gray-500 
    bg-gray-100/80 backdrop-blur-sm
    px-2.5 py-1 rounded-md font-medium
    shadow-sm
  `,
  messagesContainer: `flex-1 overflow-hidden relative`,
  messagesArea: `
    absolute inset-0 overflow-y-auto 
    p-4 space-y-1 scroll-smooth
    scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
    hover:scrollbar-thumb-gray-400
  `
}
