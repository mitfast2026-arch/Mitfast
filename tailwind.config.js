/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Master MITFAST Palette Breakdown
        palette: {
          bgPrimary: '#F7F7F8',       // Off-White / Soft Fog (Primary Background)
          bgSecondary: '#ECEEF0',     // Cool Platinum Grey (Cards / Panels / Surfaces)
          textPrimary: '#111315',     // Charcoal / Soft Black (Primary Text / Dark Accents / Buttons)
          textMuted: '#6B7280',       // Medium Steel Grey (Muted Text / Subtitles)
          border: '#E2E4E8',          // Light Muted Slate (Borders / Divider Lines)
          heroSky: '#D7D9DC',         // Overcast Warm Grey (Hero Image Sky / Ambient Blend)
          gunmetal: '#1F2429',        // Dark Gunmetal (Deep Industrial Shadows / Footer)
        },
        surface: {
          primary: '#F7F7F8',
          secondary: '#ECEEF0',
          elevated: '#FFFFFF',
          dark: '#1F2429',
          charcoal: '#111315',
          sky: '#D7D9DC',
        },
        mono: {
          950: '#111315', // Charcoal / Soft Black
          900: '#1F2429', // Dark Gunmetal
          800: '#2A3036',
          700: '#4B5563',
          500: '#6B7280', // Medium Steel Grey
          400: '#9CA3AF',
          300: '#D7D9DC', // Overcast Warm Grey
          200: '#E2E4E8', // Light Muted Slate
          100: '#ECEEF0', // Cool Platinum Grey
          50: '#F7F7F8',  // Off-White / Soft Fog
        }
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      fontFamily: {
        // Strict 3-font system — no fallbacks
        sans: ['var(--font-inter)'],
        heading: ['var(--font-instrument)'],
        display: ['var(--font-instrument)'],
        mono: ['var(--font-chivo-mono)'],
        numeric: ['var(--font-chivo-mono)'],
      },
    },
  },
  plugins: [],
};
