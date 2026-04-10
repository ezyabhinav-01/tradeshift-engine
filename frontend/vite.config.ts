import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Get backend URL from environment or default to localhost
const targetUrl = process.env.VITE_API_URL || 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
  tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/auth': {
        target: targetUrl,
        changeOrigin: true,
      },
      '/api': {
        target: targetUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: targetUrl,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
