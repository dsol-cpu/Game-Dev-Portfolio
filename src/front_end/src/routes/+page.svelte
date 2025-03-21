<script>
	import Portfolio from '../sections/Portfolio.svelte';
	import ResumeModal from '../components/ResumeModal.svelte';
	import { onMount } from 'svelte';

	let themeApplied = false;

	onMount(() => {
		const theme = localStorage.getItem('theme') || 'dark'; // Get theme from localStorage or default to light
		document.documentElement.setAttribute('data-theme', theme);
		themeApplied = true; // Mark that the theme has been applied
	});
</script>

{#if themeApplied}
	<ResumeModal />
	<Portfolio />
{/if}
