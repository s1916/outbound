/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E3A8A', // Deep Blue
          light: '#3B82F6',
          dark: '#1E40AF',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          800: '#1F2937',
          900: '#111827',
        }
      }
    },
  },
  plugins: [],
}