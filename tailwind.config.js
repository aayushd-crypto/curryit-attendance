/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF3EE', 100: '#FFE0D0', 200: '#FFC0A0',
          300: '#FF9560', 400: '#FF6B20', 500: '#E8531D',
          600: '#C44010', 700: '#9C300A', 800: '#7A2408', 900: '#591A06',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #E8531D 0%, #C44010 100%)',
      },
    },
  },
  plugins: [],
}
