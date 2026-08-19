/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        rnli: {
          orange: '#F47920',
          dark: '#002649',
          blue: '#003366',
        },
        safe: '#28a745',
        alert: '#dc3545',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'current-hour-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.55' },
        },
      },
      animation: {
        'current-hour': 'current-hour-pulse 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
