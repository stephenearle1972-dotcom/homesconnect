/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: '#1A6B5C',
        'teal-bright': '#22A88F',
        gold: '#C6922A',
        'gold-bright': '#E8B73E',
        'bg-dark': '#0d1b12',
        'bg-mid': '#1e3428',
        'bg-card': '#15261c',
        'border-soft': 'rgba(255,255,255,0.08)',
        'wa-green': '#25D366',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        elev: '0 30px 60px -20px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
