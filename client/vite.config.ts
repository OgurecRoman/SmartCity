import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: {
      // меньше шума в Network/DevTools при нескольких вкладках
      overlay: true,
      clientPort: 5173,
    },
    watch: {
      // на Windows меньше лишних reconnect по node_modules
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  css: {
    // CSS source maps часто вешают Styles-панель Chrome на токенах Max UI
    devSourcemap: false,
  },
  optimizeDeps: {
    include: ['@maxhub/max-ui', 'axios', '@tanstack/react-query'],
  },
})
