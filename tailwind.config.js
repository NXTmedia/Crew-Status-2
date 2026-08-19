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
          '0%, 100%': {
            borderColor: 'rgba(255, 255, 255, 1)',
            boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.7)',
          },
          '50%': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
            boxShadow: '0 0 0 6px rgba(255, 255, 255, 0)',
          },
        },
      },
      animation: {
        'current-hour': 'current-hour-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
