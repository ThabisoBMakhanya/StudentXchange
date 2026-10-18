/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#101114', blue: { DEFAULT: '#1749d1', dark: '#1037a6', pale: '#eaf0ff' }, paper: '#f7f8fb' }, boxShadow: { soft: '0 18px 50px rgba(16,17,20,.08)' } } },
  plugins: []
};
