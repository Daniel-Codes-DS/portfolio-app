import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ניתוח תיק השקעות",
        short_name: "תיק שלי",
        description: "ניתוח תיק השקעות מבוסס AI",
        theme_color: "#1f7a6c",
        background_color: "#ffffff",
        dir: "rtl",
        lang: "he",
        start_url: "/",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
