/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Define custom colors for your dark theme
        darkBackground: '#0f172a',  // Darker blue-gray
        darkSurface: '#1e293b',    // Slightly lighter surface
        darkBorder: '#334155',     // Visible borders
        darkText: '#e2e8f0',       // Light gray text
      },
    },
  },          // Enable dark mode with class-based approach
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}