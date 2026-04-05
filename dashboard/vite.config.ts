import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/dash": "http://localhost:9877",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
