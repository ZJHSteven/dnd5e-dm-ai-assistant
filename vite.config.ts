import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 配置 - 用于构建前端 React 应用
export default defineConfig({
  plugins: [react()], // 启用 React 插件支持 JSX
  build: {
    outDir: 'dist', // 输出目录，与 wrangler.jsonc 中的 assets.directory 对应
    sourcemap: true, // 生成 source map 便于调试
  },
  server: {
    port: 3000, // 开发服务器端口
    proxy: {
      // 代理 API 请求到本地 Cloudflare Worker 开发服务器
      '/api': 'http://localhost:8787'
    }
  }
})