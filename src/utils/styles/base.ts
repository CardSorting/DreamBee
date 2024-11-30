export const baseStyles = {
  container: `flex h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-gray-50 to-white`,
  overlay: `
    fixed inset-0 
    bg-black/20 backdrop-blur-sm z-20
    transition-opacity duration-300 ease-in-out
    animate-fadeIn
  `
}
