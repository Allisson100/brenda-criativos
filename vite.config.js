import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { open: true },
  // Formatos de criativo aceitos na pasta src/criativos
  assetsInclude: ['**/*.mp4', '**/*.webm', '**/*.mov', '**/*.gif'],
})
