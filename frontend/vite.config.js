import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // SPA: bilinmeyen rotalar (örn. /haber/:id) yenilenince index.html'e düşsün.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      includeAssets: [
        "icon.svg",
        "favicon-32.png",
        "icon-180.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
      ],
      manifest: {
        name: "Singularity News",
        short_name: "Singularity News",
        description:
          "Küresel haberleri bağlam temelli, gazetecilik diliyle Türkçeye çeviren prestijli haber platformu.",
        theme_color: "#0a0e1b",
        background_color: "#04050a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon.svg",
            type: "image/svg+xml",
            sizes: "any",
          },
        ],
      },
    }),
  ],
});
