/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        petpal: {
          ink: '#101828',
          muted: '#667085',
          soft: '#f7f4ff',
          cream: '#fff8ef',
          lilac: '#5b37ff',
          blue: '#2f80ff',
          mint: '#16b981',
          coral: '#ff7a59',
          gold: '#f4b740',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 14px 45px rgba(16, 24, 40, 0.08)',
        lift: '0 22px 70px rgba(16, 24, 40, 0.14)',
        glow: '0 18px 60px rgba(91, 55, 255, 0.18)',
      },
      keyframes: {
        'pp-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pp-soft-pop': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pp-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pp-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'pp-fade-up 520ms ease both',
        'soft-pop': 'pp-soft-pop 420ms ease both',
        float: 'pp-float 5s ease-in-out infinite',
        shimmer: 'pp-shimmer 1.45s linear infinite',
      },
    },
  },
};

