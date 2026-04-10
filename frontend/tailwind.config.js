/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#09090b', // zinc-950
          card: '#18181b', // zinc-900
          border: '#27272a', // zinc-800
          blue: '#3b82f6', // blue-500
          teal: '#14b8a6', // teal-500
          rose: '#f43f5e', // rose-500
          emerald: '#10b981', // emerald-500
          text: '#f4f4f5', // zinc-100
          muted: '#a1a1aa' // zinc-400
        }
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', '"Roboto Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
