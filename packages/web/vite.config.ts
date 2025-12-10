import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/metadata": "http://localhost:4000",
      "/auth": "http://localhost:4000",
      "/live": "http://localhost:4000",
      "/stats": "http://localhost:4000"
    }
  },
  preview: {
    // Allow public domain access when running `npm run preview`
    allowedHosts: ["steamviewdashboard.online", "www.steamviewdashboard.online"]
  }
});
