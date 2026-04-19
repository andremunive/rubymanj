/** @type {import('tailwindcss').Config} */
module.exports = {
  // Angular 16 con NgModules — rutas de todos los templates y componentes
  content: [
    './src/**/*.html',
    './src/**/*.ts',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          50:  '#fbf4fd',
          100: '#f6e8fb',
          200: '#eccef6',
          300: '#ddaaee',
          400: '#cb6ce6', // base
          500: '#b95ad3',
          600: '#a84fc2',
          700: '#8c3da3',
          800: '#6e3280',
          900: '#4f2460',
        },
        accent: {
          50:  '#fdf2f7',
          100: '#fce7f0',
          300: '#f4a5c7',
          500: '#ec6fa4',
          700: '#bd3874',
        },
        neutral: {
          50:  '#fafaf9',
          100: '#f5f4f2',
          200: '#e9e6e3',
          300: '#d5d1cd',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#3f3c38',
          800: '#28262a',
          900: '#1a181c',
        },
        success: { 500: '#16a34a', 100: '#dcfce7' },
        warning: { 500: '#d97706', 100: '#fef3c7' },
        danger:  { 500: '#dc2626', 100: '#fee2e2' },
      },
    },
  },
  plugins: [],
};
