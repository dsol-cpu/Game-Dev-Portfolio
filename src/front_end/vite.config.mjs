import { spawn } from "child_process";
import { promises as fs } from "fs";
import path, { dirname } from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import { chunkSplitPlugin } from "vite-plugin-chunk-split";
import compression from "vite-plugin-compression2";
import glsl from "vite-plugin-glsl";
import gltf from "vite-plugin-gltf";
import { createHtmlPlugin } from "vite-plugin-html";
import imagemin from "vite-plugin-imagemin";
import { PurgeCSS } from "purgecss";
import crypto from "crypto";
import { random } from "./src/js/utils/random";

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate secure random hash for filenames
const generateSecureHash = () => {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(4).toString("hex");
  return `${timestamp}-${randomBytes}`;
};

// Safely run a command using spawn with proper error handling
const safelyRunCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      ...options,
      shell: false, // Avoid shell interpretation of arguments
    });

    let stdout = "";
    let stderr = "";

    childProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("error", (error) => {
      reject(new Error(`Command error: ${error.message}`));
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        reject(new Error(`Command exited with code ${code}: ${stderr}`));
      }
    });
  });
};

// Check if a command is available in the system
const checkCommandAvailability = async (command) => {
  try {
    const args = command === "ffmpeg" ? ["-version"] : ["-h"];
    await safelyRunCommand(command, args);
    return true;
  } catch {
    return false;
  }
};

// PurgeCSS plugin for Vite with async optimization
const purgeCSSPlugin = (options = {}) => {
  return {
    name: "vite-plugin-purgecss",
    apply: "build", // Only run during build
    generateBundle: async (opts, bundle) => {
      const defaultOptions = {
        content: [
          "./index.html",
          "./src/**/*.{js,ts,jsx,tsx,vue,html}",
          "./public/**/*.html",
        ],
        css: [],
        defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
        safelist: [
          // Common framework classes that might be added dynamically
          /^body$/,
          /^html$/,
          // Three.js related classes that might be added dynamically
          /^three-/,
          /^webgl-/,
          // Animation classes
          /^animate-/,
          /^transition-/,
          // State classes
          /^active$/,
          /^focus$/,
          /^hover$/,
        ],
        ...options,
      };

      // Find CSS files in the bundle
      const cssFiles = Object.keys(bundle).filter((fileName) =>
        fileName.endsWith(".css")
      );

      if (cssFiles.length === 0) {
        console.log("No CSS files found to purge");
        return;
      }

      console.log(`🎨 Purging CSS from ${cssFiles.length} file(s)...`);

      // Process CSS files in parallel for better performance
      const purgePromises = cssFiles.map(async (fileName) => {
        try {
          const cssBundle = bundle[fileName];
          if (
            cssBundle.type === "asset" &&
            typeof cssBundle.source === "string"
          ) {
            const purgeResult = await new PurgeCSS().purge({
              ...defaultOptions,
              css: [{ raw: cssBundle.source, extension: "css" }],
            });

            if (purgeResult.length > 0) {
              const originalSize = cssBundle.source.length;
              const purgedCSS = purgeResult[0].css;
              const newSize = purgedCSS.length;
              const reduction = (
                ((originalSize - newSize) / originalSize) *
                100
              ).toFixed(2);

              cssBundle.source = purgedCSS;

              console.log(
                `✅ Purged ${fileName}: ${originalSize} → ${newSize} bytes (${reduction}% reduction)`
              );
              return { fileName, success: true, reduction };
            }
          }
          return { fileName, success: false, reason: "No purge needed" };
        } catch (error) {
          console.error(`Error purging CSS for ${fileName}:`, error);
          return { fileName, success: false, error: error.message };
        }
      });

      // Wait for all CSS purging to complete
      await Promise.allSettled(purgePromises);
    },
  };
};

// Enhanced audio file processing function with file size tracking
const processAudioFile = async (
  file,
  audioDir,
  outputDir,
  fileIndex = 0,
  totalFiles = 0
) => {
  try {
    const inputPath = path.join(audioDir, file);
    const fileName = path.parse(file).name;
    const fileExt = path.extname(file).toLowerCase();

    // Validate file exists before processing
    await fs.access(inputPath);
    const inputStats = await fs.stat(inputPath);
    const originalSize = inputStats.size;

    // Create a hash for the filename to match your build configuration pattern
    const hash = generateSecureHash();

    // Determine output format and path
    let outputFileName;
    let outputFormat;
    let ffmpegArgs;

    // Set appropriate compression settings based on file type
    switch (fileExt) {
      case ".mp3":
        outputFileName = `${fileName}.${hash}.mp3`;
        outputFormat = "mp3";
        ffmpegArgs = [
          "-i",
          inputPath,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "128k",
          "-map_metadata",
          "0", // Preserve metadata
          "-y", // Overwrite output files
          path.join(outputDir, outputFileName),
        ];
        break;
      case ".flac":
      case ".wav":
        outputFileName = `${fileName}.${hash}.mp3`;
        outputFormat = "mp3";
        ffmpegArgs = [
          "-i",
          inputPath,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "192k",
          "-map_metadata",
          "0",
          "-y",
          path.join(outputDir, outputFileName),
        ];
        break;
      case ".ogg":
        outputFileName = `${fileName}.${hash}.ogg`;
        outputFormat = "ogg";
        ffmpegArgs = [
          "-i",
          inputPath,
          "-c:a",
          "libvorbis",
          "-q:a",
          "5",
          "-map_metadata",
          "0",
          "-y",
          path.join(outputDir, outputFileName),
        ];
        break;
      case ".m4a":
        outputFileName = `${fileName}.${hash}.m4a`;
        outputFormat = "m4a";
        ffmpegArgs = [
          "-i",
          inputPath,
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-map_metadata",
          "0",
          "-y",
          path.join(outputDir, outputFileName),
        ];
        break;
      default:
        throw new Error(`Unsupported audio format: ${fileExt}`);
    }

    const progressPrefix =
      totalFiles > 1 ? `[${fileIndex + 1}/${totalFiles}] ` : "";
    console.log(
      `🎵 ${progressPrefix}Compressing: ${file} (${(
        originalSize / 1024
      ).toFixed(1)}KB)`
    );

    const startTime = Date.now();
    await safelyRunCommand("ffmpeg", ffmpegArgs);
    const duration = Date.now() - startTime;

    // Get compressed file size
    const outputPath = path.join(outputDir, outputFileName);
    const outputStats = await fs.stat(outputPath);
    const compressedSize = outputStats.size;
    const compressionRatio = (
      ((originalSize - compressedSize) / originalSize) *
      100
    ).toFixed(1);

    console.log(
      `✅ ${progressPrefix}${file}: ${(originalSize / 1024).toFixed(1)}KB → ${(
        compressedSize / 1024
      ).toFixed(1)}KB ` + `(${compressionRatio}% reduction, ${duration}ms)`
    );

    return {
      file,
      success: true,
      outputFormat,
      duration,
      originalSize,
      compressedSize,
      compressionRatio: parseFloat(compressionRatio),
    };
  } catch (err) {
    console.error(`❌ Error processing ${file}: ${err.message}`);
    return { file, success: false, error: err.message };
  }
};

// Improved audio compression plugin with better state management
const audioCompressionPlugin = () => {
  // Use a unique identifier for this plugin instance
  const pluginId = `audio-compression-${Date.now()}-${random()
    .toString(36)
    .slice(2, 9)}`;
  let hasProcessed = false;

  return {
    name: "audio-compression-plugin",
    writeBundle: {
      // Use sequential hook to ensure proper ordering
      order: "post",
      handler: async () => {
        // Prevent multiple executions within this plugin instance
        if (hasProcessed) {
          console.log(
            `🎵 [${pluginId}] Audio compression already completed for this instance, skipping...`
          );
          return;
        }

        hasProcessed = true;
        console.log(`🎵 [${pluginId}] Starting audio compression...`);

        const audioDir = path.resolve(__dirname, "public/audio");
        const outputDir = path.resolve(__dirname, "build/assets/audio");

        try {
          // Check if audio directory exists
          try {
            await fs.access(audioDir);
          } catch {
            console.log(
              "🎵 No audio directory found, skipping audio compression"
            );
            return;
          }

          // Check if ffmpeg is available
          const ffmpegAvailable = await checkCommandAvailability("ffmpeg");
          if (!ffmpegAvailable) {
            console.warn(
              "\x1b[33m%s\x1b[0m",
              "⚠️  WARNING: FFmpeg is not installed or not in PATH. Audio compression will be skipped.\n" +
                "   Please install FFmpeg to enable audio compression: https://ffmpeg.org/download.html"
            );
            return;
          }

          // Create output directory if it doesn't exist
          await fs.mkdir(outputDir, { recursive: true });

          // Get all audio files
          const files = await fs.readdir(audioDir);

          // Filter for audio files
          const supportedExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
          const audioFiles = files.filter((file) =>
            supportedExtensions.includes(path.extname(file).toLowerCase())
          );

          if (audioFiles.length === 0) {
            console.log("🎵 No audio files found to compress");
            return;
          }

          console.log(
            `🎵 Found ${audioFiles.length} audio file(s) to compress...`
          );
          const startTime = Date.now();

          // Process audio files in parallel with controlled concurrency
          const concurrencyLimit = Math.min(4, audioFiles.length); // Don't exceed file count
          const batches = [];

          for (let i = 0; i < audioFiles.length; i += concurrencyLimit) {
            batches.push(audioFiles.slice(i, i + concurrencyLimit));
          }

          const allResults = [];

          // Process batches sequentially, but files within each batch in parallel
          for (const [batchIndex, batch] of batches.entries()) {
            if (batches.length > 1) {
              console.log(
                `🎵 Processing batch ${batchIndex + 1}/${batches.length} (${
                  batch.length
                } files)...`
              );
            }

            const batchPromises = batch.map((file, index) => {
              const globalIndex = batchIndex * concurrencyLimit + index;
              return processAudioFile(
                file,
                audioDir,
                outputDir,
                globalIndex,
                audioFiles.length
              );
            });

            const batchResults = await Promise.allSettled(batchPromises);
            allResults.push(...batchResults);
          }

          // Calculate summary statistics
          const successful = allResults.filter(
            (r) => r.status === "fulfilled" && r.value?.success
          );
          const failed = allResults.length - successful.length;
          const totalDuration = Date.now() - startTime;

          if (successful.length > 0) {
            const successfulResults = successful.map((r) => r.value);
            const totalOriginalSize = successfulResults.reduce(
              (sum, r) => sum + (r.originalSize || 0),
              0
            );
            const totalCompressedSize = successfulResults.reduce(
              (sum, r) => sum + (r.compressedSize || 0),
              0
            );
            const overallCompressionRatio =
              totalOriginalSize > 0
                ? (
                    ((totalOriginalSize - totalCompressedSize) /
                      totalOriginalSize) *
                    100
                  ).toFixed(1)
                : 0;

            const avgCompressionTime =
              successfulResults.reduce((sum, r) => sum + (r.duration || 0), 0) /
              successful.length;

            console.log(
              `🎵 Audio compression complete! ${successful.length} successful, ${failed} failed`
            );
            console.log(
              `📊 Total size: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(
                totalCompressedSize / 1024
              ).toFixed(1)}KB ` + `(${overallCompressionRatio}% reduction)`
            );
            console.log(
              `⏱️  Total time: ${totalDuration}ms, Average per file: ${avgCompressionTime.toFixed(
                0
              )}ms`
            );
          } else {
            console.log(
              `🎵 Audio compression complete! 0 successful, ${failed} failed`
            );
          }

          if (failed > 0) {
            console.warn(
              "⚠️  Some audio files could not be compressed. Check logs for details."
            );
          }
        } catch (error) {
          console.error("❌ Error during audio compression setup:", error);
        }
      },
    },
  };
};

// Helper function to check if ffmpeg is installed
const checkFFmpegInstallation = () => {
  return {
    name: "check-ffmpeg-plugin",
    buildStart: async () => {
      const ffmpegAvailable = await checkCommandAvailability("ffmpeg");
      if (!ffmpegAvailable) {
        console.warn(
          "\x1b[33m%s\x1b[0m",
          "⚠️  WARNING: FFmpeg is not installed or not in PATH. Audio compression will be skipped.\n" +
            "   Please install FFmpeg to enable audio compression: https://ffmpeg.org/download.html"
        );
      } else {
        console.log("✅ FFmpeg detected - audio compression enabled");
      }
    },
  };
};

// Async image optimization plugin wrapper
const asyncImageOptimization = () => {
  return imagemin({
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
    webp: { quality: 80 },
  });
};

// Async compression plugins with optimized settings
const createCompressionPlugins = () => {
  return [
    // Brotli compression (better compression ratio)
    compression({
      algorithm: "brotliCompress",
      threshold: 10240, // Only compress files larger than 10KB
      exclude: [/\.(jpg|jpeg|png|gif|webp|glb|gltf|hdr)$/i],
      deleteOriginFile: false,
      compressionOptions: {
        level: 11, // Maximum compression
      },
    }),
    // Gzip compression (broader compatibility)
    compression({
      algorithm: "gzip",
      threshold: 10240,
      exclude: [/\.(jpg|jpeg|png|gif|webp|glb|gltf|hdr)$/i],
      deleteOriginFile: false,
      compressionOptions: { level: 9 }, // Maximum compression
    }),
  ];
};

// Update the plugins list to include all async optimizations
export default defineConfig({
  plugins: [
    // Check for FFmpeg before starting the build
    checkFFmpegInstallation(),

    // HTML minification with async processing
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

    // Shader and model plugins
    glsl(),
    gltf(),

    // Async image optimization
    asyncImageOptimization(),

    // Code splitting with async optimization
    chunkSplitPlugin({
      strategy: "default",
      customSplitting: {
        three: [/three\.module\.js/, /three\/examples\/jsm/],
        vendor: [/node_modules/],
      },
    }),

    // Async audio compression
    audioCompressionPlugin(),

    // Async PurgeCSS with parallel processing
    purgeCSSPlugin({
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx,vue,html}",
        "./public/**/*.html",
      ],
      // Add any additional classes you want to keep
      safelist: [
        // Three.js classes
        /^three-/,
        /^webgl-/,
        // Animation classes
        /^animate-/,
        /^transition-/,
        // State classes
        /^active$/,
        /^focus$/,
        /^hover$/,
        /^loading$/,
        // Add your custom classes here
      ],
    }),

    // Async compression plugins
    ...createCompressionPlugins(),

    // Bundle analyzer
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
          const extType = assetInfo.names.pop();
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
    host: "localhost",
    port: 5174,
    strictPort: false,
    cors: true,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false,
    },
    headers: {
      "Cache-Control": "no-store",
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

  //   resolve: {
  //     alias: {
  //       "@": path.resolve(__dirname, "./src"),
  //       "@js": path.resolve(__dirname, "./src/js"),
  //       "@css": path.resolve(__dirname, "./src/css"),
  //       "@documents": path.resolve(__dirname, "./public/documents"),
  //       "@models": path.resolve(__dirname, "./public/models"),
  //       "@shaders": path.resolve(__dirname, "./public/shaders"),
  //     },
  //   },
});
