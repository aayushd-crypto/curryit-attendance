/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF3EE',
          100: '#FFE0D0',
          200: '#FFC0A0',
          300: '#FF9560',
          400: '#FF6B20',
          500: '#E8531D',
          600: '#C44010',
          700: '#9C300A',
          800: '#7A2408',
          900: '#591A06',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 4px 24px rgba(232, 83, 29, 0.25)',
        'card':  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
