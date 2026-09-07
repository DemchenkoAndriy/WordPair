import { fileURLToPath, URL } from 'node:url'
import { copyFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages віддає проєкт із підкаталогу (`/<repo>/`), а не з кореня домену.
 * Шлях приходить із CI (`PUBLIC_BASE_PATH`), щоб форк або перейменування репозиторію
 * не вимагали правок у коді. Локально збірка йде з кореня.
 */
const base = process.env['PUBLIC_BASE_PATH'] ?? '/'

/**
 * GitHub Pages не вміє rewrite: будь-який шлях, крім наявного файлу, дає 404.
 * Копія index.html під іменем 404.html робить із цього SPA-fallback.
 */
function spaFallback(): Plugin {
  return {
    name: 'wordpair:spa-fallback',
    apply: 'build',
    closeBundle() {
      copyFileSync('dist/index.html', 'dist/404.html')
    },
  }
}

// Швидкий запуск — головна вимога продукту.
// Тому: PWA-precache усього шелу + колод, мінімум залежностей, окремі чанки для колод.
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'WordPair',
        short_name: 'WordPair',
        description: 'Мікро-тренування словникових пар замість скролу',
        lang: 'uk',
        // Відносні шляхи: працюють і з кореня домену, і з підкаталогу Pages.
        start_url: './?source=pwa',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0d17',
        theme_color: '#0b0d17',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${base}index.html`,
      },
    }),
    spaFallback(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false, // один малий CSS -> менше запитів на холодному старті
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
