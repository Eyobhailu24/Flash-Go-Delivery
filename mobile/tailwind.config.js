module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#f97316',
        background: '#fffaf5',
        foreground: '#20232b',
        muted: '#727681',
        border: '#f0e8df',
      },
    },
  },
  plugins: [],
};
