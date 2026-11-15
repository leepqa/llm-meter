import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // слушаем все интерфейсы, иначе Vite 5 слушает только ::1 и 127.0.0.1 не отвечает
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // у бэкенда нет префикса /api — срезаем его
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
