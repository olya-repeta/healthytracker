/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#F4F7F5',
          100: '#E6EFE9',
          200: '#CCE0D3',
          300: '#A8C9B5',
          400: '#7FA990',
          500: '#5C8D73',
          600: '#46715B',
          700: '#395B4A',
          800: '#2F493C',
          900: '#273D32',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
