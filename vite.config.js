import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
   resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  }
  server: {
    port: 5173,
    // Proxy /api calls to Vercel dev server locally
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
