/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E5C76B',
          dark: '#B89420',
        },
        charcoal: {
          DEFAULT: '#121212',
          light: '#1E1E1E',
          dark: '#0A0A0A',
        },
        cream: {
          DEFAULT: '#F5F5DC',
          light: '#FFFDF0',
          dark: '#E8E8C0',
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(212, 175, 55, 0.3)',
      }
    },
  },
  plugins: [],
}
