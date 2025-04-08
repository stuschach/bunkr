/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
      extend: {
        colors: {
          // Golf-inspired color palette
          green: {
            fairway: "#4D8A54", // Medium green for fairways
            light: "#8FBC8F", // Light green for UI elements
            dark: "#2E5E33", // Dark green for accents
          },
          sand: {
            bunker: "#E2D2A2", // Light sand color
            dark: "#D6C38C", // Darker sand for accents
          },
          sky: {
            light: "#87CEEB", // Light blue for sky/water elements
            dark: "#4682B4", // Darker blue for accents
          },
          // UI colors
          primary: "#4D8A54", // Our main brand color (fairway green)
          secondary: "#E2D2A2", // Secondary color (bunker sand)
          background: "#FFFFFF", // Light mode background
          "background-dark": "#121212", // Dark mode background
          text: "#121212", // Light mode text
          "text-dark": "#F8F8F8", // Dark mode text
          border: "#E2E8F0", // Default border color
        },
        fontFamily: {
          sans: ["var(--font-titillium)", "system-ui", "sans-serif"],
          heading: ["var(--font-titillium)", "system-ui", "sans-serif"],
          body: ["var(--font-inter)", "system-ui", "sans-serif"],
        },
      },
    },
    plugins: [
      // Add this plugin to explicitly define custom utility classes
      function({ addUtilities }) {
        const newUtilities = {
          '.font-body': {
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          },
          '.font-heading': {
            fontFamily: 'var(--font-titillium), system-ui, sans-serif',
          },
        }
        addUtilities(newUtilities)
      }
    ],
};