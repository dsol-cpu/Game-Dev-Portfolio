<script lang="ts">
	import { theme } from '../lib/stores/theme';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { derived } from 'svelte/store';

	let isDark: boolean | undefined = undefined; // undefined initially to indicate theme is pending
	let themeLoaded = false; // Pending state to track if the theme has been applied

	// Derived store to sync the theme with the UI
	const currentTheme = derived(theme, ($theme) => $theme === 'dark');

	// Apply theme synchronously in the browser (before render)
	onMount(() => {
		if (browser) {
			// Get the stored theme from localStorage, or default to 'dark'
			const storedTheme = localStorage.getItem('theme') || 'dark';
			isDark = storedTheme === 'dark'; // Set the initial theme state
			document.documentElement.setAttribute('data-theme', storedTheme); // Apply the theme immediately
			document.documentElement.classList.toggle('dark', isDark); // Toggle the dark class

			// Mark theme as loaded to avoid flicker
			themeLoaded = true;
		}
	});

	// Watch the theme store to update `isDark` state reactively
	currentTheme.subscribe((value) => {
		isDark = value;
	});

	// Toggle theme
	function toggleTheme() {
		theme.toggleTheme();
	}
</script>

{#if themeLoaded}
	<!-- Only render the button once theme is loaded and applied -->
	<button
		on:click={toggleTheme}
		class="relative h-10 w-10 rounded-lg p-2 hover:bg-gray-200/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
		aria-label="Toggle theme"
	>
		<div class="relative h-6 w-6 overflow-hidden">
			<!-- Sun icon -->
			<img
				src="sun.svg"
				alt="Light mode"
				class="absolute h-6 w-6 transform transition-transform duration-500 {isDark
					? 'translate-y-6'
					: 'translate-y-0'}"
			/>
			<!-- Moon icon -->
			<img
				src="moon.svg"
				alt="Dark mode"
				class="absolute h-6 w-6 transform transition-transform duration-500 {isDark
					? 'translate-y-0'
					: '-translate-y-6'}"
			/>
		</div>
	</button>
{/if}
