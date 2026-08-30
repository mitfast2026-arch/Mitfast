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
        // Portal tokens — CSS vars so admin (dark) / customer (light) themes remint correctly
        portal: {
          canvas: 'var(--portal-canvas)',
          sidebar: 'var(--portal-sidebar)',
          panel: 'var(--portal-panel)',
          inset: 'var(--portal-inset)',
          border: 'var(--portal-border)',
          'border-strong': 'var(--portal-border-strong)',
          text: 'var(--portal-text)',
          muted: 'var(--portal-muted)',
          subtle: 'var(--portal-subtle)',
          accent: 'var(--portal-accent)',
          'accent-hover': 'var(--portal-accent-hover)',
          selected: 'var(--portal-selected)',
          focus: 'var(--portal-focus)',
          hero: 'var(--portal-hero)',
          'hero-text': 'var(--portal-hero-text)',
          hover: 'var(--portal-hover)',
          success: 'var(--portal-success)',
          'success-soft': 'var(--portal-success-soft)',
          warning: 'var(--portal-warning)',
          'warning-soft': 'var(--portal-warning-soft)',
          danger: 'var(--portal-danger)',
          'danger-soft': 'var(--portal-danger-soft)',
          info: 'var(--portal-info)',
          'info-soft': 'var(--portal-info-soft)',
          'status-blue': 'var(--portal-status-blue)',
          'status-orange': 'var(--portal-status-orange)',
          'status-yellow': 'var(--portal-status-yellow)',
          'status-green': 'var(--portal-status-green)',
          'status-text': 'var(--portal-status-text)',
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
      zIndex: {
        sticky: 'var(--z-sticky)',
        header: 'var(--z-header)',
        'bottom-nav': 'var(--z-bottom-nav)',
        backdrop: 'var(--z-backdrop)',
        drawer: 'var(--z-drawer)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        toast: 'var(--z-toast)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-instrument)', 'system-ui', 'sans-serif'],
        display: ['var(--font-instrument)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        numeric: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
