import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend's CORS allows http://localhost:3000, but proxying /api keeps
// REST and the live WebSocket on one origin.
const backend = process.env.CALME_API_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/api": { target: backend, changeOrigin: true, ws: true },
      "/docs": { target: backend, changeOrigin: true },
      "/openapi.json": { target: backend, changeOrigin: true },
    },
  },
});
