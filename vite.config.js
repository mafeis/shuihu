import { cpSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",
  plugins: [
    {
      name: "copy-comfy-assets",
      apply: "build",
      transformIndexHtml(html) {
        return html.replace(
          "connect-src 'self' ws://localhost:* http://localhost:*;",
          "connect-src 'self';",
        );
      },
      closeBundle() {
        const source = resolve(process.cwd(), "assets");
        const target = resolve(process.cwd(), "dist/assets");
        mkdirSync(target, { recursive: true });
        for (const directory of [
          "audio",
          "characters",
          "enemies",
          "environments",
          "ui",
          "video",
        ]) {
          cpSync(resolve(source, directory), resolve(target, directory), {
            recursive: true,
            filter(sourcePath) {
              return basename(sourcePath) !== "turnaround.png";
            },
          });
        }
      },
    },
  ],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data.js")) return "game-data";
          if (id.includes("/node_modules/lucide/")) return "lucide";
          return undefined;
        },
      },
    },
  },
});
