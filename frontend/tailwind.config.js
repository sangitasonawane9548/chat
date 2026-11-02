/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '375px',      // Mobile: 375px–575px
      'sm': '576px',      // Large mobile: 576px–767px
      'md': '768px',      // Tablet: 768px–1023px
      'lg': '1024px',     // Small desktop: 1024px–1279px
      'xl': '1280px',     // Desktop: 1280px–1535px
      '2xl': '1536px',    // Large desktop: 1536px+
    },
    extend: {
      colors: {
        brand: {
          bg: 'var(--bg-main)',
          surface: 'var(--bg-surface)',
          'surface-elevated': 'var(--bg-surface-elevated)',
          sidebar: 'var(--bg-sidebar)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          border: 'var(--border-subtle)',
          'border-strong': 'var(--border-strong)',

          // Core Electric Violet & Lavender Brand Palette
          primary: '#8B5CF6',
          'primary-hover': '#7C3AED',
          'primary-light': 'rgba(139, 92, 246, 0.15)',
          lavender: '#A78BFA',
          purple: '#A855F7',

          // Supporting Accents
          coral: '#FF6B81',
          pink: '#F0ABFC',
          secondary: '#35D6B5',
          'secondary-hover': '#29C7A6',
          'secondary-light': 'rgba(53, 214, 181, 0.15)',
          online: '#10B981',
          danger: '#EF4444'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        body: ['Inter', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 25px -4px rgba(139, 92, 246, 0.38)',
        'glow-lavender': '0 0 25px -4px rgba(167, 139, 250, 0.35)',
        'glow-secondary': '0 0 25px -4px rgba(53, 214, 181, 0.35)',
        'glow-coral': '0 0 25px -4px rgba(255, 107, 129, 0.35)',
        'glass': 'var(--shadow-glass)',
        'card': 'var(--shadow-card)',
        'elevated': '0 20px 40px -15px rgba(0, 0, 0, 0.25)'
      }
    },
  },
  plugins: [],
}
