<script lang="ts">
	import { theme } from '../lib/stores/theme';
	import Header from './Header.svelte';
	import Footer from './Footer.svelte';
	import Sidebar from '../sections/Sidebar.svelte';
	import { onMount } from 'svelte';

	$: mainBgClass = $theme === 'dark' ? 'bg-[#4e1939]' : 'bg-gray-100';
	$: contentBgClass = $theme === 'dark' ? 'bg-[#1C1C1C]' : 'bg-white';

	let sidebarWidth = '280px'; // Match the default width from your Sidebar component
	let isMobile = false;

	onMount(() => {
		// Check if we're on mobile initially
		isMobile = window.innerWidth < 768;

		// Update on resize
		window.addEventListener('resize', () => {
			isMobile = window.innerWidth < 768;
		});
	});
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<!-- Sidebar -->
	<Sidebar />

	<!-- Main content area that adjusts based on sidebar -->
	<div
		class={`flex h-screen flex-col overflow-y-auto ${mainBgClass}`}
		style="width: {isMobile ? '100%' : `calc(100% - ${sidebarWidth})`}; margin-left: {isMobile
			? '0'
			: sidebarWidth};"
	>
		<main class="w-full flex-1">
			<slot></slot>
		</main>

		<Footer />
	</div>
</div>
