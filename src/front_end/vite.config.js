import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Get the base path from environment variable or use '/' as default
  const basePath = process.env.BASE_PATH || "/";

  return {
    plugins: [tailwindcss(), solidPlugin()],
    base: basePath,
    server: {
      port: 5173,
    },
    build: {
      target: "esnext",
      outDir: "build", // Match the path in your GitHub Actions workflow
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
  };
});
