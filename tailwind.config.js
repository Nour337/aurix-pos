/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { 50: '#EEF3FD', 100: '#D9E3FA', 200: '#B3C7F4', 300: '#7F9FE8', 400: '#4A75D6', 500: '#1747B5', 600: '#133C9A', 700: '#10327F', 800: '#10265C', 900: '#0B1B42' },
        navy: '#10265C',
        gold: { 50: '#FBF6EA', 100: '#F5EACB', 200: '#ECD69B', 300: '#E2C277', 400: '#D8B15A', 500: '#C49A3E', 600: '#A47E2F', 700: '#7E6024' },
        soft: '#F4F6FA',
        ink: { DEFAULT: '#172033', 600: '#3B4660', 500: '#5B6680', 400: '#8A93A8', 300: '#C3C9D6', 200: '#E3E7EF', 100: '#EEF1F6' },
      },
      fontFamily: {
        sans: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', '"IBM Plex Sans Arabic"', 'Georgia', 'serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,38,92,.04), 0 4px 16px rgba(16,38,92,.06)',
        lift: '0 8px 30px rgba(16,38,92,.14)',
        gold: '0 0 0 1px rgba(216,177,90,.55), 0 6px 20px rgba(216,177,90,.18)',
      },
      borderRadius: { xl: '0.85rem', '2xl': '1.15rem' },
      keyframes: {
        in: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },
      animation: { in: 'in .25s ease-out both', pop: 'pop .18s ease-out both' },
    },
  },
  plugins: [],
};
