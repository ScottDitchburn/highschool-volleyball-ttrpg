import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so GitHub Pages project-site assets work regardless of repo name
  base: './',
  build: {
    // Don't delete existing dist files before building (sandbox permission constraint)
    emptyOutDir: false,
  },
})
