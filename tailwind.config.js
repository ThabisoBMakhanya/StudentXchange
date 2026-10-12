/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1D4ED8',
          50: '#EEF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        secondary: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          lighter: '#DDD6FE',
        },
        accent: {
          DEFAULT: '#0EA5E9',
          light: '#38BDF8',
          lighter: '#BAE6FD',
        },
        ink: {
          DEFAULT: '#111827',
          secondary: '#4B5563',
          tertiary: '#9CA3AF',
        },
        surface: {
          DEFAULT: '#F5F7FB',
          border: '#E2E8F0',
          dark: '#EDF2F7',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: '#FFF7ED',
        },
        success: {
          DEFAULT: '#10B981',
          bg: '#ECFDF5',
        },
        danger: {
          DEFAULT: '#EF4444',
          bg: '#FEF2F2',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 8px 24px -16px rgba(15, 23, 42, 0.35)',
        'card-hover': '0 20px 40px -24px rgba(37, 99, 235, 0.35), 0 10px 18px -14px rgba(15, 23, 42, 0.2)',
        elevate: '0 24px 56px -28px rgba(30, 64, 175, 0.35), 0 12px 20px -16px rgba(15, 23, 42, 0.2)',
        'btn-primary': '0 12px 24px -12px rgba(37, 99, 235, 0.6)',
        'btn-primary-hover': '0 18px 32px -16px rgba(37, 99, 235, 0.72)',
        glow: '0 0 0 6px rgba(96, 165, 250, 0.18)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.18)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #0A3D91 0%, #3B82F6 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
        'gradient-accent': 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 100%)',
        'gradient-card': 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        'gradient-hero': 'linear-gradient(135deg, #0A3D91 0%, #2563EB 50%, #3B82F6 100%)',
        'gradient-subtle': 'linear-gradient(135deg, #EEF3FC 0%, #F8FAFC 100%)',
        'gradient-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
