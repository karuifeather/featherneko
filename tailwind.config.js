/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Accent — use sparingly
        primary: {
          DEFAULT: '#4a7c7c',
          foreground: '#f0f9ff',
          dark: '#3d6969',
        },
        secondary: '#669999',
        'secondary-dark': '#cc6666',
        // Premium neutrals
        neutral: {
          950: '#0a0a0b',
          900: '#141416',
          800: '#1c1e21',
          700: '#2d2f33',
        },
      },
    },
  },
  plugins: [],
};
