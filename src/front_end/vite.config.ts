import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/api': {
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			}
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: './src/test/setup.js',
		coverage: {
			reporter: ['text', 'html'],
			exclude: ['node_modules/*', 'src/**/*.{test,spec}.{js,ts}']
		}
	},
	build: {
		sourcemap: process.env.NODE_ENV !== 'production',
		minify: 'terser',
		target: 'es2020'
	}
});
