import { cpSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { defineConfig } from "vite";

export const DEV_SERVER_HOST = "0.0.0.0";
export const DEV_SERVER_PORT = 5173;

export const RUNTIME_ASSET_DIRECTORIES = Object.freeze([
  "audio",
  "characters",
  "enemies",
  "environments",
  "ui",
  "video",
  "vfx/kenney",
]);

export const BATTLE_VFX_RUNTIME_FILES = Object.freeze([
  "blade_arc.webp",
  "blade_cut.webp",
  "impact_spark.webp",
  "hit_spark.webp",
  "heavy_dust.webp",
  "volley_trace.webp",
  "ultimate_star.webp",
  "restore_glow.webp",
]);

export default defineConfig({
  publicDir: "public",
  server: {
    host: DEV_SERVER_HOST,
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  preview: {
    host: DEV_SERVER_HOST,
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  plugins: [
    {
      name: "copy-runtime-assets",
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
        for (const directory of RUNTIME_ASSET_DIRECTORIES) {
          const sourceDirectory = resolve(source, directory);
          cpSync(resolve(source, directory), resolve(target, directory), {
            recursive: true,
            filter(sourcePath) {
              if (sourcePath === sourceDirectory) return true;
              const fileName = basename(sourcePath);
              if (fileName === "turnaround.png") return false;
              if (directory === "vfx/kenney") {
                return (
                  /\.txt$/i.test(fileName) ||
                  BATTLE_VFX_RUNTIME_FILES.includes(fileName)
                );
              }
              return true;
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
