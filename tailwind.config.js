// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Golf-inspired color palette integrated with standard Tailwind names
        green: {
          50: '#f0f7f0',
          100: '#d8ead9',
          200: '#b8d7ba',
          300: '#8fbc8f', // Light green
          400: '#6da96f',
          500: '#4d8a54', // Fairway green (main brand color)
          600: '#3f7245',
          700: '#2e5e33', // Dark green
          800: '#234927',
          900: '#17301a',
        },
        sand: {
          50: '#faf8f0',
          100: '#f5f0e0',
          200: '#ede4c7',
          300: '#e2d2a2', // Bunker sand
          400: '#d6c38c', // Darker sand
          500: '#c9b274',
          600: '#b09857',
          700: '#8c7944',
          800: '#665937',
          900: '#413a25',
        },
        sky: {
          50: '#f0f7fb',
          100: '#d9edf7',
          200: '#b0ddf0',
          300: '#87ceeb', // Light blue for sky/water
          400: '#5db9e2',
          500: '#3d9bd1',
          600: '#4682b4', // Darker blue
          700: '#3a6992',
          800: '#2e516f',
          900: '#1e3447',
        },
      },
      fontFamily: {
        sans: ["var(--font-titillium)", "system-ui", "sans-serif"],
        heading: ["var(--font-titillium)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInBottom: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        slideInTop: {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in-right': 'slideInRight 0.3s ease-in-out',
        'slide-in-left': 'slideInLeft 0.3s ease-in-out',
        'slide-in-bottom': 'slideInBottom 0.3s ease-in-out',
        'slide-in-top': 'slideInTop 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
};