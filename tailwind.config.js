/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        raised: 'var(--raised)',
        line: 'var(--line)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        danger: 'var(--danger)'
      },
      fontFamily: {
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
