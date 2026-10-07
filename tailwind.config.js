/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        tradition: ['Marcellus', 'serif'],
        admin: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
