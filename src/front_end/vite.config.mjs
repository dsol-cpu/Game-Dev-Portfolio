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
      gifsicle: { optimizationLevel: 3 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80, progressive: true },
      pngquant: { quality: [0.8, 0.9], speed: 4 },
      svgo: {
        plugins: [{ name: "removeViewBox", active: false }],
      },
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
      algorithm: "gzip",
      threshold: 10240, // 10KB
      exclude: [/\.(jpg|jpeg|png|gif|webp)$/i],
      compressionOptions: { level: 9 },
    }),

    // Also add Brotli compression for even better performance
    compression({
      algorithm: "brotliCompress",
      threshold: 10240,
      exclude: [/\.(jpg|jpeg|png|gif|webp)$/i],
      compressionOptions: { level: 11 },
    }),

    // Bundle size visualization (creates stats.html after build)
    visualizer({
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ],

  build: {
    outDir: "../dist",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
      },
      format: {
        comments: false,
      },
      mangle: {
        safari10: true,
      },
    },
    rollupOptions: {
      input: {
        // Add all your HTML pages here
        main: path.resolve(__dirname, "index.html"),
        // Example: Add additional pages if you have them
        // about: path.resolve(__dirname, "about.html"),
        // projects: path.resolve(__dirname, "projects.html"),
      },
      output: {
        // Optimize for caching and organization
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split(".").at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name].[hash][extname]`;
          }
          if (/css/i.test(extType)) {
            return `assets/css/[name].[hash][extname]`;
          }
          if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
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
    // Optimization for Three.js applications
    target: "esnext",
    sourcemap: false,
    // This helps with large 3D models
    assetsInlineLimit: 4096, // Only inline files smaller than 4kb
  },

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
    "**/*.hdr", // HDR textures for Three.js
    "**/*.mp3", // Audio files
    "**/*.wav",
    "**/*.vert",
    "**/*.frag", // Shader files
  ],

  // Optimize development experience
  server: {
    open: true,
    host: true,
    cors: true,
    hmr: {
      overlay: true,
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@js": path.resolve(__dirname, "./src/js"),
      "@css": path.resolve(__dirname, "./src/css"),
      "@models": path.resolve(__dirname, "./src/assets/models"),
      "@shaders": path.resolve(__dirname, "./src/assets/shaders"),
    },
  },
});
