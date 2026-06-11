import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_TARGET ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
