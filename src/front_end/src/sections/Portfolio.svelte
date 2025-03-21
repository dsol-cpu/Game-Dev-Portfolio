<script lang="ts">
	import { theme } from '../lib/stores/theme';
	import Header from './Header.svelte';
	import Footer from './Footer.svelte';
	import Sidebar from '../components/Sidebar.svelte';

	$: mainBgClass = $theme === 'dark' ? 'bg-[#4e1939]' : 'bg-gray-100';
	$: contentBgClass = $theme === 'dark' ? 'bg-[#1C1C1C]' : 'bg-white';
</script>

<main class="flex flex-col items-center overflow-hidden {mainBgClass}">
	<div class={contentBgClass}>
		<Sidebar/>
	</div>
	<Footer />
</main>
