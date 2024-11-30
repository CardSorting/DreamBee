export const sidebarStyles = {
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
}
