import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 将 /api 开头的请求代理到后端 Spring Boot
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 将 /uploads 开头的请求代理到后端，用于访问上传的图片
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
