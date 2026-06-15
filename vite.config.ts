import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: [
      '.loca.lt',
      '.lhr.life',
      '.trycloudflare.com',
      '.serveousercontent.com',
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: [
      '.loca.lt',
      '.lhr.life',
      '.trycloudflare.com',
      '.serveousercontent.com',
    ],
  },
})
