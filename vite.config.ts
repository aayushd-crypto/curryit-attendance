import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts
          'vendor-charts': ['recharts'],
          // PDF export (heavy — load separately)
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // Excel export (heavy — load separately)
          'vendor-excel': ['xlsx'],
        },
      },
    },
  },
})
