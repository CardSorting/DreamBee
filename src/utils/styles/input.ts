export const inputStyles = {
  container: `
    sticky bottom-0 
    bg-gradient-to-t from-white via-white/95 to-white/50
    backdrop-blur-lg
    border-t border-gray-100
    px-4 py-4
    z-10
  `,
  wrapper: `
    max-w-3xl mx-auto
    relative
    rounded-2xl
    bg-white
    shadow-lg
    border border-gray-200/80
    hover:border-blue-200
    focus-within:border-blue-400
    focus-within:ring-4
    focus-within:ring-blue-50
    transition-all duration-200
    overflow-hidden
  `,
  field: `
    w-full
    px-5 py-4
    pr-[4.5rem]
    bg-transparent
    text-gray-800
    placeholder:text-gray-400
    rounded-2xl
    outline-none
    resize-none
    disabled:opacity-60
    min-h-[60px]
    max-h-[200px]
    overflow-y-auto
    text-[15px]
    leading-relaxed
    transition-all
    duration-200
  `,
  button: {
    base: `
      absolute right-3 bottom-3
      w-[42px] h-[42px]
      rounded-xl
      font-medium
      transition-all duration-200
      flex items-center justify-center
      transform-gpu scale-100
      hover:scale-105
      active:scale-95
    `,
    enabled: `
      bg-gradient-to-br from-blue-500 to-blue-600
      text-white
      shadow-md
      hover:shadow-lg
      hover:from-blue-600 hover:to-blue-700
      active:from-blue-700 active:to-blue-800
    `,
    disabled: `
      bg-gray-100
      text-gray-400
      cursor-not-allowed
      transform-gpu scale-100
      hover:scale-100
    `
  }
}
