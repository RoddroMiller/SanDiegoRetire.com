/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mwm-gold': '#C5A059',
        'mwm-emerald': '#1A3628',
        'mwm-green': '#009639',
        'mwm-silver': '#9FA3A6',
        'mwm-black': '#1A1A1A',
      },
    },
  },
  plugins: [],
}