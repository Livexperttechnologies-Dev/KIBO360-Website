import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on port 3001 (strictPort, so it never clashes with other local
// projects). /api and /uploads are proxied to the KIBO360 backend on 5001.
// KIBO_DEV_PORT / KIBO_API_TARGET override both for isolated test runs.
const port = Number(process.env.KIBO_DEV_PORT) || 3001;
const api = process.env.KIBO_API_TARGET || "http://localhost:5001";

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    proxy: {
      "/api": api,
      "/uploads": api,
    },
  },
  // The SSR bundle must be self-contained so the Node site server can load it
  // without the frontend's node_modules.
  ssr: { noExternal: true },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
