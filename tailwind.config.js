/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm orange primary — volleyball / fire palette
        orange: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#E8741E', // brand primary
          700: '#c2591a',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Charcoal / near-black neutrals
        charcoal: {
          50:  '#f7f7f7',
          100: '#e3e3e3',
          200: '#c8c8c8',
          300: '#a4a4a4',
          400: '#818181',
          500: '#666666',
          600: '#515151',
          700: '#434343',
          800: '#383838',
          900: '#1f1f1f',
          950: '#121212',
        },
        // Off-white surface
        surface: {
          50:  '#fafaf8',
          100: '#f5f5f0',
          200: '#ededе4',
          300: '#e0e0d6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        // Subtle court-line gradient accent
        'court-lines': 'repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(232,116,30,0.08) 59px, rgba(232,116,30,0.08) 60px)',
      },
    },
  },
  plugins: [],
}
