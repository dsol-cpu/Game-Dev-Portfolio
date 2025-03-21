<script>
	import { theme } from '../lib/stores/theme';
	import ResumeButton from '../components/ResumeButton.svelte';
	$: footerClass = $theme === 'dark' ? 'bg-zinc-900 text-stone-300' : 'bg-gray-100 text-zinc-700';
</script>

<footer id="contact" class="relative w-full {footerClass}">
	<div class="relative mx-auto flex max-w-7xl flex-col items-center px-6 py-4 md:px-16 md:py-6">
		<div class="text-center">
			<p>Copyright © 2025 David Solinsky.</p>
			<p>All rights reserved.</p>
		</div>
		<div class="mt-8 sm:mt-10 sm:w-auto">
			<ResumeButton />
		</div>
	</div>
</footer>
