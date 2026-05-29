// ============================================================
// TAILWIND CONFIG — Impero delle Waifu
// Mappa i design token CSS del progetto (variabili in globals.css)
// in classi Tailwind utilizzabili in tutti i componenti Vue.
// ============================================================

import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      // ── SFONDI (ink-*) ──────────────────────────────────────
      colors: {
        ink: {
          void:    '#03020c',
          abyss:   '#07051a',
          night:   '#0d0a26',
          violet:  '#15102f',
          'elev-1':'#1b1638',
          'elev-2':'#251f48',
        },
        gold: {
          DEFAULT: '#f5c560',
          light:   '#ffe9a8',
          deep:    '#c08a1f',
        },
        sakura: {
          DEFAULT: '#ff85b6',
          light:   '#ffc3da',
          deep:    '#c54a86',
        },
        aqua: {
          DEFAULT: '#6cf0e0',
          light:   '#b8faf2',
          deep:    '#1aa899',
        },
        violet: {
          DEFAULT: '#a78bfa',
          deep:    '#6938e8',
        },
        // ── RARITÀ ──────────────────────────────────────────────
        rar: {
          comune:      '#b4bcc8',
          raro:        '#5aa9ff',
          epico:       '#b573ff',
          leggendario: '#ffc861',
          immersivo:   '#ff7eb6',
        },
        // ── TESTI ──────────────────────────────────────────────
        text: {
          DEFAULT: '#f1ebff',
          dim:     '#b6aed6',
          mute:    '#6b6390',
          faint:   '#3e3760',
        },
        // ── ACCENTI GIOCO ───────────────────────────────────────
        green:  '#58e0a3',
        red:    '#ff5b6c',
      },

      // ── FONT FAMILIES ─────────────────────────────────────────
      fontFamily: {
        display: ['Unbounded', 'Cinzel', 'system-ui', 'sans-serif'],
        label:   ['Saira Condensed', 'Orbitron', 'sans-serif'],
        body:    ['DM Sans', 'Fredoka', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Orbitron', 'ui-monospace', 'monospace'],
        cinzel:  ['Cinzel', 'serif'],
      },

      // ── BORDER RADIUS ──────────────────────────────────────────
      borderRadius: {
        '2':   '4px',
        '3':   '8px',
        '4':   '12px',
        '5':   '16px',
        '6':   '22px',
        pill:  '999px',
      },

      // ── BOX SHADOWS ────────────────────────────────────────────
      boxShadow: {
        card: '0 10px 36px rgba(3,2,12,0.6), 0 1px 0 rgba(255,255,255,0.04) inset',
        pop:  '0 22px 60px rgba(3,2,12,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
        'glow-gold':    '0 0 24px rgba(245,197,96,0.4)',
        'glow-sakura':  '0 0 24px rgba(255,133,182,0.45)',
        'glow-violet':  '0 0 24px rgba(167,139,250,0.4)',
      },

      // ── ANIMAZIONI ─────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'fade-up':    'fadeUp 0.5s ease-out forwards',
        shimmer:      'shimmer 4s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 1.8s ease-in-out infinite',
        'foil-sweep': 'foilSweep 4.5s linear infinite',
        'spin-slow':  'spinSlow 8s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeUp:    { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        glowPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px currentColor)' },
          '50%':      { filter: 'drop-shadow(0 0 24px currentColor)' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.025)' },
        },
        foilSweep: {
          '0%':   { maskPosition: '-200% 0', WebkitMaskPosition: '-200% 0' },
          '100%': { maskPosition: '200% 0',  WebkitMaskPosition: '200% 0' },
        },
        spinSlow:  { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },

      // ── GRADIENTS (background-image shortcut) ──────────────────
      backgroundImage: {
        'page-bg': 'linear-gradient(180deg, #0a0726 0%, #050314 60%, #02010a 100%)',
        'card-bg':  'linear-gradient(180deg, rgba(27,22,56,0.55), rgba(13,10,38,0.7))',
        'gold-btn': 'linear-gradient(135deg, #f5c560, #ffa033)',
        'sakura-btn': 'linear-gradient(135deg, #ff85b6, #c54a86)',
      },

      // ── TOUCH TARGET minimo 44px per Capacitor ─────────────────
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
} satisfies Config
