import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Pure Vite SPA — targets Firebase Hosting.
// Backend lives in Supabase (DB + Auth + Edge Functions).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { host: true, port: 8080, strictPort: false },
  preview: { host: true, port: 8080 },
  build: { outDir: "dist", sourcemap: false },
});
