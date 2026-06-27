import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  server: {
    port: 3001,
    proxy: {
      "/admin-api": {
        target: process.env.ADMIN_API_UPSTREAM ?? "http://localhost:8080",
        rewrite: (p) => p.replace(/^\/admin-api/, "/admin"),
        changeOrigin: true,
      },
    },
  },
});
