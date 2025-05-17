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
import crypto from "crypto";

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
      reject({ error, stdout, stderr });
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        reject({
          success: false,
          code,
          stdout,
          stderr,
          error: new Error(`Command exited with code ${code}`),
        });
      }
    });
  });
};

// Check if a command is available in the system
const checkCommandAvailability = async (command) => {
  try {
    // Use the '-h' flag which most commands support for help
    // This minimizes any side effects while checking availability
    const args = command === "ffmpeg" ? ["-version"] : ["-h"];
    await safelyRunCommand(command, args);
    return true;
  } catch (error) {
    return false;
  }
};

// Audio compression plugin with improved security and error handling
const audioCompressionPlugin = () => {
  return {
    name: "audio-compression-plugin",
    closeBundle: async () => {
      const audioDir = path.resolve(__dirname, "public/audio");
      const outputDir = path.resolve(__dirname, "build/assets/audio");

      try {
        // Check if ffmpeg is available first
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

        console.log(`Found ${audioFiles.length} audio files to compress...`);

        // Process each audio file with proper error handling
        const compressionResults = await Promise.allSettled(
          audioFiles.map(async (file) => {
            try {
              const inputPath = path.join(audioDir, file);
              const fileName = path.parse(file).name;
              const fileExt = path.extname(file).toLowerCase();

              // Validate file exists before processing
              await fs.access(inputPath);

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
                    path.join(outputDir, outputFileName),
                  ];
                  break;
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
                    path.join(outputDir, outputFileName),
                  ];
                  break;
                case ".flac":
                  outputFileName = `${fileName}.${hash}.mp3`;
                  outputFormat = "mp3";
                  ffmpegArgs = [
                    "-i",
                    inputPath,
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "192k",
                    path.join(outputDir, outputFileName),
                  ];
                  break;
                default:
                  throw new Error(`Unsupported audio format: ${fileExt}`);
              }

              if (ffmpegArgs) {
                console.log(`Compressing: ${file} -> ${outputFileName}`);

                // Use the safer spawn method instead of exec
                const result = await safelyRunCommand("ffmpeg", ffmpegArgs);
                console.log(`Successfully compressed ${file}`);
                return { file, success: true, outputFormat };
              }

              return {
                file,
                success: false,
                reason: "No ffmpeg command created",
              };
            } catch (err) {
              console.error(`Error processing ${file}: ${err.message}`);
              return { file, success: false, error: err.message };
            }
          })
        );

        // Summary of compression results
        const successful = compressionResults.filter(
          (r) => r.status === "fulfilled" && r.value?.success
        ).length;
        const failed = compressionResults.length - successful;

        console.log(
          `Audio compression complete! ${successful} successful, ${failed} failed`
        );

        if (failed > 0) {
          console.warn(
            "Some audio files could not be compressed. Check logs for details."
          );
        }
      } catch (error) {
        console.error("Error during audio compression setup:", error);
      }
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

// Update the plugins list to include the check for FFmpeg
export default defineConfig({
  plugins: [
    // Check for FFmpeg before starting the build
    checkFFmpegInstallation(),

    // Rest of plugins remain the same
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
    glsl(),
    gltf(),
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
      webp: { quality: 80 },
    }),
    chunkSplitPlugin({
      strategy: "default",
      customSplitting: {
        three: [/three\.module\.js/, /three\/examples\/jsm/],
        vendor: [/node_modules/],
      },
    }),
    audioCompressionPlugin(),
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
    host: "localhost", // Changed from 'true' to 'localhost'
    port: 5174,
    strictPort: false, // Allow Vite to try other ports if 5173 is in use
    cors: true,
    hmr: {
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
