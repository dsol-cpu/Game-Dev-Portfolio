import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import imagemin from "vite-plugin-imagemin";
import compression from "vite-plugin-compression2";
import { chunkSplitPlugin } from "vite-plugin-chunk-split";
import glsl from "vite-plugin-glsl";
import gltf from "vite-plugin-gltf";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig({
  plugins: [
    // HTML processing and minification
    createHtmlPlugin({
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
      },
    }),

    // Add GLSL shader support (important for Three.js)
    glsl(),

    // GLTF model optimization
    gltf(),

    // Image optimization
    imagemin({
      gifsicle: { optimizationLevel: 7, interlaced: false },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80, progressive: true },
      pngquant: { quality: [0.65, 0.9], speed: 4 },
      svgo: {
        plugins: [
          { name: "removeViewBox", active: false },
          { name: "removeEmptyAttrs", active: true },
          { name: "removeUnusedNS", active: true },
          { name: "cleanupIDs", active: true },
          { name: "removeDimensions", active: true },
        ],
      },
      webp: { quality: 80 }, // Add WebP conversion
    }),

    // Intelligent code splitting (adapted for vanilla JS)
    chunkSplitPlugin({
      strategy: "default",
      customSplitting: {
        // Split Three.js into its own chunk
        three: [/three\.module\.js/, /three\/examples\/jsm/],
        // Put all vendor code in a separate chunk
        vendor: [/node_modules/],
      },
    }),

    // Compression options
    compression({
      algorithm: "brotliCompress",
      threshold: 10240,
      exclude: [/\.(jpg|jpeg|png|gif|webp|glb|gltf|hdr)$/i],
      deleteOriginFile: false,
      compressionOptions: {
        level: 11,
      },
    }),

    compression({
      algorithm: "gzip",
      threshold: 10240,
      exclude: [/\.(jpg|jpeg|png|gif|webp|glb|gltf|hdr)$/i],
      deleteOriginFile: false,
      compressionOptions: { level: 9 },
    }),

    // Bundle size visualization (creates stats.html after build)
    visualizer({
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
      open: false,
      template: "treemap",
    }),
  ],

  build: {
    outDir: "./build",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
        passes: 3,
        unsafe: true,
        unsafe_math: true,
        unsafe_symbols: true,
        ecma: 2020,
      },
      format: {
        comments: false,
        ascii_only: true,
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_/,
        },
      },
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        // Optimize for caching and organization
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split(".").pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name].[hash][extname]`;
          }
          if (/css/i.test(extType)) {
            return `assets/css/[name].[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(extType)) {
            return `assets/fonts/[name].[hash][extname]`;
          }
          if (/mp3|wav|ogg/i.test(extType)) {
            return `assets/audio/[name].[hash][extname]`;
          }
          if (/glb|gltf/i.test(extType)) {
            return `assets/models/[name].[hash][extname]`;
          }
          return `assets/[name].[hash][extname]`;
        },
        chunkFileNames: "assets/js/[name].[hash].js",
        entryFileNames: "assets/js/[name].[hash].js",
        manualChunks(id) {
          // Three.js specific code splitting
          if (id.includes("three")) {
            return "three";
          }
          // Split other vendor modules for better caching
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
    copyPublicDir: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
    modulePreload: {
      polyfill: true,
    },
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
  },

  // publicDir: "src/assets",
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
    "**/*.hdr", // HDR textures for Three.js
    "**/*.mp3", // Audio files
    "**/*.wav",
    "**/*.vert",
    "**/*.frag", // Shader files
  ],

  // Optimize development experience with corrected server settings
  server: {
    open: true,
    host: "localhost", // Changed from 'true' to 'localhost'
    port: 5174,
    strictPort: false, // Allow Vite to try other ports if 5173 is in use
    cors: true,
    hmr: {
      // protocol: "ws",
      // host: "localhost",
      // port: 5173,
      // clientPort: 5173,
      overlay: true,
    },
    watch: {
      usePolling: false, // Try not using polling first
    },
    headers: {
      "Cache-Control": "no-store", // Changed to prevent caching during development
    },
  },

  optimizeDeps: {
    exclude: ["@vite/client", "@vite/env"],
    esbuildOptions: {
      target: "esnext",
    },
  },

  cacheDir: ".vite-cache",

  define: {
    "process.env.NODE_ENV": process.env.NODE_ENV
      ? JSON.stringify(process.env.NODE_ENV)
      : '"development"',
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@js": path.resolve(__dirname, "./src/js"),
      "@css": path.resolve(__dirname, "./src/css"),
      "@documents": path.resolve(__dirname, "./public/documents"),
      "@models": path.resolve(__dirname, "./public/models"),
      "@shaders": path.resolve(__dirname, "./public/shaders"),
    },
  },
});
