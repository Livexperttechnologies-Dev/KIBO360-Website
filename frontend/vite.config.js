import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 3001 is pinned (strictPort) so it never clashes with other local projects.
// All /api calls are proxied to the KIBO360 backend on port 5001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
