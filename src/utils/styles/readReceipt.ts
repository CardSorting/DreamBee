export const readReceiptStyles = {
  container: `
    hidden group-hover:flex items-center justify-end
    h-4
    opacity-70
    transition-all duration-200
    absolute
    -bottom-4
    right-12
    gap-1
    z-10
    bg-white/90
    backdrop-blur-sm
    px-2
    py-0.5
    rounded-full
    shadow-sm
    text-[10px]
    transform-gpu translate-y-0
    group-hover:translate-y-0.5
  `,
  icon: `
    w-2.5 h-2.5
    text-blue-500/80
    transform-gpu translate-y-0
    transition-all duration-200
    group-hover:text-blue-500
  `
}
