import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true,
      clientPort: 5173,
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  css: {
    devSourcemap: false,
  },
  optimizeDeps: {
    include: ['@maxhub/max-ui', 'axios', '@tanstack/react-query'],
  },
})
