<script lang="ts">
	import { writable } from 'svelte/store';
	import '../app.css';
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';
	import { derived } from 'svelte/store';
	import { browser } from '$app/environment';

	// Derived store to handle the theme
	const themeClass = derived(theme, ($theme) => {
		return $theme === 'dark' ? 'dark' : 'light';
	});

	// Create a writable store to track if the theme has been loaded
	const themeLoaded = writable(false);

	// Set the theme on mount and apply it to the <html> and <body> tags (only in the browser)
	onMount(() => {
		if (browser) {
			const storedTheme = localStorage.getItem('theme');
			const initialTheme = storedTheme ? storedTheme : 'dark'; // Default to 'dark' if no stored theme

			// Apply the theme immediately to prevent flickering
			document.documentElement.setAttribute('data-theme', initialTheme);
			document.body.classList.add(initialTheme); // Apply theme to body as well

			// Apply theme class to <html> and <body>
			document.documentElement.classList.toggle('dark', initialTheme === 'dark');
			document.body.classList.toggle('dark', initialTheme === 'dark');

			themeLoaded.set(true); // Set themeLoaded to true to render the components
		}
	});

	// Automatically apply the theme when it changes (only in the browser)
	if (browser) {
		themeClass.subscribe(($themeClass) => {
			// Save the theme in localStorage
			localStorage.setItem('theme', $themeClass);

			// Apply theme to <html> and <body>
			document.documentElement.setAttribute('data-theme', $themeClass);
			document.documentElement.classList.toggle('dark', $themeClass === 'dark');
			document.body.classList.toggle('dark', $themeClass === 'dark');
		});
	}

	let { children } = $props();
</script>

<svelte:head>
	<meta property="og:title" content="David Solinsky's software engineer portfolio website" />
	<meta property="og:description" content="David Solinsky's software engineer portfolio website" />
	<meta property="og:image" content="portfolio_website_icon.svg" />
	<meta property="og:url" content="https://dsol-cpu.github.io/SWE-Portfolio" />
	<meta property="og:type" content="website" />
	<meta name="theme-color" content="black" />
	<meta name="twitter:card" content="portfolio_website_icon.svg" />
	<meta name="twitter:title" content="David Solinsky's software engineer portfolio website" />
	<meta
		name="twitter:description"
		content="David Solinsky's software engineer portfolio website."
	/>
	<meta name="twitter:image" content="portfolio_website_icon.svg" />
</svelte:head>

{#if $themeLoaded}
	{@render children()}
{/if}
