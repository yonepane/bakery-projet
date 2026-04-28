/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        luxury: ['"Outfit"', 'sans-serif'],
      },
      colors: {
        gold: {
          DEFAULT: '#E2C275',
          light: '#F8E7B2',
          dark: '#B08E3B',
          glow: 'rgba(226, 194, 117, 0.4)',
        },
        charcoal: {
          DEFAULT: '#0B0F17',
          light: '#131A26',
          dark: '#030712',
        },
        cream: {
          DEFAULT: '#F8FAFC',
          light: '#FFFFFF',
          dark: '#E2E8F0',
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))',
        'gold-gradient': 'linear-gradient(135deg, #F8E7B2 0%, #E2C275 50%, #B08E3B 100%)',
        'mesh-dark': 'radial-gradient(circle at 15% 50%, rgba(226, 194, 117, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(37, 99, 235, 0.05), transparent 25%)',
      },
      boxShadow: {
        'gold-glow': '0 0 20px rgba(226, 194, 117, 0.2), inset 0 0 10px rgba(226, 194, 117, 0.05)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 12px 40px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 0 15px rgba(226, 194, 117, 0.2)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
