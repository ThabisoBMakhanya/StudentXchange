/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: 'var(--sx-text)', blue: { DEFAULT: 'var(--sx-blue)', dark: 'var(--sx-blue-hover)', pale: 'var(--sx-blue-soft)' }, paper: 'var(--sx-bg-soft)' }, boxShadow: { soft: '0 18px 50px rgba(var(--sx-shadow),.08)' } } },
  plugins: []
};
