export const chatStyles = {
  container: `flex h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-gray-50 to-white`,
  
  // Sidebar styles
  sidebar: {
    base: `
      fixed lg:relative w-80 h-full 
      bg-white/95 backdrop-blur-sm
      border-r border-gray-200 shadow-sm
      flex flex-col
    `,
    mobile: `z-30`,
    transition: `transition-all duration-300 ease-in-out transform`,
    states: {
      open: `translate-x-0`,
      closed: `-translate-x-full lg:translate-x-0`
    },
    header: `
      p-4 border-b border-gray-200 
      bg-white/80 backdrop-blur-sm sticky top-0 z-10
      shadow-sm
    `,
    newChatButton: `
      w-full px-4 py-2.5 
      flex items-center justify-center gap-2 
      bg-blue-600 hover:bg-blue-700 active:bg-blue-800 
      text-white rounded-lg 
      transition-all duration-200 ease-out
      text-sm font-medium 
      shadow-sm hover:shadow
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      transform-gpu hover:-translate-y-0.5 active:translate-y-0
    `,
    list: `
      flex-1 overflow-y-auto 
      scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent 
      hover:scrollbar-thumb-gray-400
      pb-4
    `,
    item: {
      base: `
        w-full px-4 py-3 
        flex items-center gap-3 
        hover:bg-gray-50 active:bg-gray-100 
        transition-all duration-200 
        border-b border-gray-100
        focus:outline-none focus:bg-gray-50
        group
      `,
      active: `
        bg-blue-50/80 hover:bg-blue-100/80 
        active:bg-blue-200/80 border-blue-100
      `,
      title: `
        text-sm font-medium text-gray-900 
        truncate group-hover:text-blue-600
        transition-colors duration-200
      `,
      date: `text-xs text-gray-500`,
      count: `
        text-xs text-gray-500
        bg-gray-100 group-hover:bg-gray-200
        px-2 py-0.5 rounded-full min-w-[1.5rem] 
        text-center font-medium
        transition-colors duration-200
      `
    }
  },

  // Message styles
  message: {
    container: (isAssistant: boolean) => `
      flex flex-col max-w-2xl mx-auto
      ${isAssistant ? 'items-start' : 'items-end'}
      transform-gpu scale-100 opacity-100
      transition-all duration-200 ease-out
      hover:scale-[1.01]
      animate-fadeIn
      py-2
    `,
    wrapper: (isAssistant: boolean) => `
      flex items-end gap-2
      ${isAssistant ? 'flex-row' : 'flex-row-reverse'}
      group
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
    `,
    timestamp: `
      text-[10px] text-gray-400 mt-1 px-1
      opacity-0 group-hover:opacity-100
      transition-opacity duration-200
      select-none
      font-medium
    `
  },

  // Typing indicator styles
  typing: {
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
  },

  // Main chat area styles
  main: {
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
  },

  // Error message styles
  error: {
    container: `p-4 mx-4`,
    content: `
      bg-red-50/80 backdrop-blur-sm
      border-l-4 border-red-400 
      p-4 rounded shadow-sm
      transform-gpu animate-slideIn
    `,
    text: `text-sm text-red-700`,
    dismissButton: `
      text-sm text-red-600 hover:text-red-800 
      font-medium mt-1 
      transition-colors duration-200
      focus:outline-none focus:underline
    `
  },

  // Input area styles
  input: {
    container: `
      border-t border-gray-200 
      bg-white/95 backdrop-blur-sm
      p-4 sticky bottom-0
      shadow-[0_-1px_2px_rgba(0,0,0,0.05)]
    `,
    wrapper: `
      max-w-3xl mx-auto 
      flex gap-4
      transform-gpu translate-y-0
      transition-all duration-200 ease-out
      animate-slideIn
    `,
    field: `
      flex-1 min-w-0 px-4 py-2.5 
      text-sm border border-gray-300 
      rounded-lg shadow-sm
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
      transition-all duration-200
      placeholder:text-gray-400
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      bg-white/80 backdrop-blur-sm
    `,
    button: {
      base: `
        px-4 py-2.5 rounded-lg 
        text-sm font-medium 
        transition-all duration-200 
        whitespace-nowrap
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:cursor-not-allowed
        transform-gpu active:scale-95
        shadow-sm hover:shadow
      `,
      enabled: `
        bg-indigo-600 text-white 
        hover:bg-indigo-700 active:bg-indigo-800
        hover:-translate-y-0.5 active:translate-y-0
        focus:ring-indigo-500
      `,
      disabled: `
        bg-gray-100 text-gray-400
        shadow-none
      `
    }
  },

  overlay: `
    fixed inset-0 
    bg-black/20 backdrop-blur-sm z-20
    transition-opacity duration-300 ease-in-out
    animate-fadeIn
  `
}
