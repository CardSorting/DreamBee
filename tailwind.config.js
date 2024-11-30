/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/utils/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'slideIn': 'slideIn 0.2s ease-out',
        'fadeIn': 'fadeIn 0.2s ease-out',
        'scaleIn': 'scaleIn 0.2s ease-out',
        'blink': 'blink 1s step-end infinite',
        'bounce-delayed': 'bounce 1s infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        blink: {
          '0%': { opacity: 1 },
          '50%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'ease-spring': 'cubic-bezier(0.25, 0.1, 0.25, 1.5)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      spacing: {
        '0.5': '0.125rem',
        '1.5': '0.375rem',
        '2.5': '0.625rem',
        '3.5': '0.875rem',
      },
      opacity: {
        '15': '0.15',
        '35': '0.35',
        '85': '0.85',
      },
      scale: {
        '98': '0.98',
        '102': '1.02',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'hover': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
  variants: {
    scrollbar: ['rounded'],
    extend: {
      opacity: ['group-hover'],
      transform: ['group-hover'],
      scale: ['group-hover', 'hover', 'active'],
      translate: ['group-hover', 'hover', 'active'],
    },
  }
}
