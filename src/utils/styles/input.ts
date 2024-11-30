export const inputStyles = {
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
}
