import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { config } from "../src/shared/config.js";

export default defineConfig({
  plugins: [react()],
  server: {
    port: config.ports.dashboard,
    strictPort: true,
    // Proxy para a Publisher API: o dashboard chama /api/... e nao precisa
    // de CORS nem de saber a porta do backend.
    proxy: {
      "/api": {
        target: `http://localhost:${config.ports.publisher}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
