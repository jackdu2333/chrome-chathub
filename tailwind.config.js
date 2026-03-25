/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mac-light': '#f0f0f0',
        'mac-text-light': '#1d1d1f',
        'mac-dark': '#1c1c1e',
        'mac-text-dark': '#f2f2f7',
      },
      fontFamily: {
        system: [
          '"SF Pro Display"',
          '"Avenir Next"',
          '"Segoe UI Variable"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        display: [
          '"Avenir Next"',
          '"Segoe UI"',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      boxShadow: {
        'mac-panel': '0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset',
        'studio-shell': '0 28px 80px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        'studio-card': '0 20px 50px rgba(2, 6, 23, 0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'studio-button': '0 14px 28px rgba(37, 99, 235, 0.28)',
      },
    },
  },
  plugins: [],
}
