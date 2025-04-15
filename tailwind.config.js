// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Preserve existing golf-inspired color palette
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
          950: '#0c1d0d',
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
          950: '#2a2618',
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
          950: '#0f1a24',
        },
        // Add gray shades for UI elements
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      fontFamily: {
        // Preserve existing font settings
        sans: ["var(--font-titillium)", "system-ui", "sans-serif"],
        heading: ["var(--font-titillium)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        card: '0 4px 20px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 10px 30px rgba(0, 0, 0, 0.12)',
        button: '0 2px 5px rgba(0, 0, 0, 0.1)',
        'button-hover': '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      keyframes: {
        // Preserve existing keyframes
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
        // Add new keyframes
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        skeletonPulse: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      },
      animation: {
        // Preserve existing animations
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in-right': 'slideInRight 0.3s ease-in-out',
        'slide-in-left': 'slideInLeft 0.3s ease-in-out',
        'slide-in-bottom': 'slideInBottom 0.3s ease-in-out',
        'slide-in-top': 'slideInTop 0.3s ease-in-out',
        // Add new animations
        'scale-in': 'scaleIn 0.4s ease-out forwards',
        'pulse': 'pulse 2s infinite',
        'skeleton-pulse': 'skeletonPulse 1.5s infinite linear'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'golfer-pattern': "url('/images/golf-pattern.png')",
        'green-texture': "url('/images/green-texture.jpg')",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};