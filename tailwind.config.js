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
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          '"Open Sans"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      boxShadow: {
        'mac-panel': '0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset',
      },
    },
  },
  plugins: [],
}
