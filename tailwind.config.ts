import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg: '#09090b',
          card: '#121216',
          surface: '#18181f',
          border: '#27272f',
          muted: '#a1a1aa'
        },
        gold: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
          accent: '#b45309'
        }
      },
      boxShadow: {
        'cinema-glow': '0 0 35px -5px rgba(245, 158, 11, 0.25)',
        'cinema-gold': '0 0 20px rgba(245, 158, 11, 0.4)'
      }
    }
  }
}

