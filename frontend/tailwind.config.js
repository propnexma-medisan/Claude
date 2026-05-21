/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#1e3a5f',
        accent: '#3b82f6',
      },
    },
  },
  plugins: [],
};
