import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./sidepanel.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: colors.neutral,
      },
    },
  },
  plugins: [],
}
