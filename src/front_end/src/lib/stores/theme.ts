import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const createThemeStore = () => {
	// Determine the default theme based on system preferences if no theme is set
	const systemTheme = browser
		? window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light'
		: 'dark'; // Default to dark theme if not in the browser

	const defaultTheme = browser ? (localStorage.getItem('theme') ?? systemTheme) : 'dark';
	const store = writable(defaultTheme);

	if (browser) {
		// Set the initial theme class on page load
		document.documentElement.classList.add(defaultTheme);
	}

	const themeStore = {
		subscribe: store.subscribe,
		toggleTheme: () => {
			if (browser) {
				const currentTheme = localStorage.getItem('theme') ?? systemTheme;
				const newTheme = currentTheme === 'light' ? 'dark' : 'light';
				localStorage.setItem('theme', newTheme);
				// Apply the new theme class to the root element
				if (newTheme === 'dark') {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
				store.set(newTheme);
			}
		},
		setTheme: (theme: 'light' | 'dark') => {
			if (browser) {
				localStorage.setItem('theme', theme);
				// Apply the theme class to the root element
				if (theme === 'dark') {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
				store.set(theme);
			}
		}
	};

	return themeStore;
};

export const theme = createThemeStore();
