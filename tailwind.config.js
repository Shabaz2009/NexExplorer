/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
        },
        border: 'var(--border-color)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          text: 'var(--accent-text)',
        },
        status: {
          success: 'var(--success)',
          warning: 'var(--warning)',
          error: 'var(--error)',
        },
        scrollbar: 'var(--scrollbar)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '6px',
      },
      fontFamily: {
        sans: ['-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
