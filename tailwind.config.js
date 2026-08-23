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
        // Admin / Supplier portal — Dark Dashboard
        portal: {
          canvas: '#0A0A0A',
          sidebar: '#0A0A0A',
          panel: '#171717',
          inset: '#212121',
          border: '#262626',
          'border-strong': '#262626',
          text: '#F5F5F5',
          muted: '#8C8C8C',
          subtle: '#8C8C8C',
          accent: '#5B8DEF',
          'accent-hover': '#7BA3F5',
          selected: '#212121',
          focus: '#5B8DEF',
          hero: '#FFFFFF',
          'hero-text': '#0A0A0A',
          hover: '#212121',
          success: '#34D399',
          'success-soft': 'rgba(52, 211, 153, 0.15)',
          warning: '#FBBF24',
          'warning-soft': 'rgba(251, 191, 36, 0.15)',
          danger: '#F87171',
          'danger-soft': 'rgba(248, 113, 113, 0.15)',
          info: '#FB923C',
          'info-soft': 'rgba(251, 146, 60, 0.15)',
          'status-blue': '#93C5FD',
          'status-orange': '#FDBA74',
          'status-yellow': '#FDE68A',
          'status-green': '#6EE7B7',
          'status-text': '#0A0A0A',
        },
        // Master MITFAST Palette Breakdown
        palette: {
          bgPrimary: '#F4F5F7',
          bgSecondary: '#F9FAFB',
          textPrimary: '#1D2939',
          textMuted: '#667085',
          border: '#E4E7EC',
          heroSky: '#D0D5DD',
          gunmetal: '#344054',
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
      borderRadius: {
        'portal-card': '24px',
        'portal-table': '20px',
        'portal-pill': '9999px',
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
