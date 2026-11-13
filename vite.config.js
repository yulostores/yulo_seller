import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The seller (coupon partner) portal. Everything it calls lives under /api/seller (see
// yulo_backend/API.md § Coupons & Coupon Partners). Point the proxy at your backend, or set
// VITE_API_BASE to skip the proxy entirely.
const BACKEND = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": BACKEND,
      "/health": BACKEND,
    },
  },
  preview: {
    rewrites: [{ source: "/(.*)", destination: "/index.html" }],
  },
});
