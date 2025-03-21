import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class', // Use 'media' to respect user's system preference
	theme: {
		extend: {
			colors: {
				background: 'var(--background)',
				text: 'var(--text)',
				primary: 'var(--primary)'
			}
		}
	},
	plugins: []
} satisfies Config;
