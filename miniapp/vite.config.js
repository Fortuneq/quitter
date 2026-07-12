import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — миниапп хостится как статика, пути должны быть относительными
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // iPhone 7 и старые WebView живут максимум на Safari 15
    target: ['es2020', 'safari15'],
  },
})
