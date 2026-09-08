import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Build khusus aplikasi offline untuk Electron: base relatif agar
// jalan dari file:// (loadFile), output di dist-offline/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    outDir: 'dist-offline',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'offline.html'),
    },
  },
})
