import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // the api keeps its own origin in dev; same-origin in prod when FastAPI
    // serves the built bundle, so the client can always just call /api/...
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
});
