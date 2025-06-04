// food_traceability_platform/frontend_typescript/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 将所有以 /api 开头的请求代理到后端服务器
      "/api": {
        target: "http://127.0.0.1:8080", // Rust 后端地址
        changeOrigin: true, // 需要修改 origin 头部
        // rewrite: (path) => path.replace(/^\/api/, '') // 如果后端API本身不带 /api 前缀，则需要重写
      },
    },
  },
});
