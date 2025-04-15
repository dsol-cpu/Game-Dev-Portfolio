import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import compression from "vite-plugin-compression";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  // Get the base path from environment variable or use appropriate default based on mode
  const basePath = process.env.BASE_PATH || (isProduction ? "/" : "/");

  return {
    plugins: [
      tailwindcss(),
      solidPlugin(),
      // Add compression for production builds
      isProduction &&
        compression({
          algorithm: "gzip",
          ext: ".gz",
        }),
    ].filter(Boolean), // Filter to remove false values from conditional plugins

    base: basePath,

    server: {
      port: 5173,
      // Add hot module replacement for better dev portfolio
      hmr: true,
    },

    build: {
      target: "esnext",
      outDir: "build",
      emptyOutDir: true,
      minify: isProduction ? "terser" : false,
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks: isProduction
            ? {
                vendor: ["solid-js", "solid-js/web", "solid-js/store"],
                // Add other large dependencies here if needed
              }
            : undefined,
          // Ensure asset filenames include hash for cache busting
          assetFileNames: (assetInfo) => {
            const extType = assetInfo.name.split(".").pop();
            // Handle .glb files and other assets appropriately
            if (/\.(glb|gltf)$/i.test(assetInfo.name)) {
              return isProduction
                ? `assets/models/[name].[hash].[ext]`
                : `assets/models/[name].[ext]`;
            }
            return isProduction
              ? `assets/[name].[hash].[ext]`
              : `assets/[name].[ext]`;
          },
        },
      },
    },

    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },

    css: {
      devSourcemap: true,
      postcss: {
        plugins: [],
      },
    },

    // Add assetsInclude to explicitly tell Vite to handle .glb files as assets
    assetsInclude: ["**/*.glb", "**/*.gltf"],

    preview: {
      port: 5174,
      host: true,
    },
  };
});
