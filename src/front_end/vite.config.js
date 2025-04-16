import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import imagemin from "vite-plugin-imagemin";
import path from "path";
import fs from "fs";

// Debug helper to log file structure before build
const logAssetDirectories = () => ({
  name: "log-asset-directories",
  buildStart() {
    console.log("🔍 Checking for asset directories:");
    const dirs = [
      "src/assets/images",
      "src/assets/models/project_card",
      "src/assets/models/game",
      "src/assets/documents",
      "src/assets/icons",
    ];

    dirs.forEach((dir) => {
      try {
        const files = fs.readdirSync(path.resolve(dir));
        console.log(`✅ Found ${dir} with ${files.length} files`);
        if (files.length > 0) {
          console.log(
            `   Sample files: ${files.slice(0, 3).join(", ")}${
              files.length > 3 ? "..." : ""
            }`
          );
        }
      } catch (e) {
        console.log(`❌ Directory not found: ${dir}`);
      }
    });
  },
});

export default defineConfig({
  plugins: [
    logAssetDirectories(),
    createHtmlPlugin({
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
        sortAttributes: true,
        sortClassName: true,
      },
    }),
    imagemin({
      gifsicle: {
        optimizationLevel: 3,
        interlaced: false,
      },
      optipng: {
        optimizationLevel: 7,
      },
      mozjpeg: {
        quality: 80,
        progressive: true,
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4,
      },
      svgo: {
        plugins: [
          {
            name: "removeViewBox",
            active: false,
          },
        ],
      },
      verbose: true,
    }),
  ],
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        assetFileNames: (assetInfo) => {
          // Simple function to preserve directory structure
          const extType = path.extname(assetInfo.name).substring(1);

          if (/png|jpe?g|svg|gif|webp/i.test(extType)) {
            return "assets/[name].[hash][extname]";
          }

          if (/glb|gltf/i.test(extType)) {
            return "assets/[name].[hash][extname]";
          }

          if (/pdf/i.test(extType)) {
            return "assets/[name].[hash][extname]";
          }

          return "assets/[name].[hash][extname]";
        },
        chunkFileNames: "assets/js/[name].[hash].js",
        entryFileNames: "assets/js/[name].[hash].js",
      },
    },
    // Copy files from public directory if you have one
    copyPublicDir: true,
  },
  // Public directory for static assets that should be copied as-is
  publicDir: "src/assets",
  assetsInclude: [
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.svg",
    "**/*.webp",
    "**/*.glb",
    "**/*.gltf",
    "**/*.pdf",
  ],
});
