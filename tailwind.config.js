/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep blue-black palette for dark mode
        dark: {
          bg: '#090D16',       // Deepest blue-black
          surface: '#0F172A',  // Slate/navy surface
          card: '#162036',     // Card background
          border: '#1E293B',   // Border
          hover: '#24324D',
          muted: '#94A3B8',
          text: '#F8FAFC'
        },
        // Material light colors for voting feedback
        material: {
          green: {
            light: '#E8F5E9',
            border: '#81C784',
            darkBorder: '#4CAF50',
            darkBg: '#133E2B',
            text: '#1B5E20',
            darkText: '#A7F3D0'
          },
          red: {
            light: '#FFEBEE',
            border: '#E57373',
            darkBorder: '#EF4444',
            darkBg: '#451A1A',
            text: '#B71C1C',
            darkText: '#FECACA'
          }
        }
      }
    },
  },
  plugins: [],
}
