<script lang="ts">
	import IconWithName from './IconWithName.svelte';
	import { getTechIcon } from '../utils/techIcons';
	import { theme } from '../lib/stores/theme';

	export let title: string;
	export let items: Array<{ name: string; icon: string }>;
</script>

<div class="flex flex-col items-center">
	<h3 class="mb-6 text-center text-sm font-medium uppercase tracking-wider text-stone-400">
		{title}
	</h3>
	<div class="w-full rounded-xl bg-white/5 p-6 shadow-lg backdrop-blur-sm">
		<div class="flex flex-wrap items-center justify-center gap-6">
			{#each items as item}
				{@const resolvedIcon = getTechIcon(item.icon, item.name)}

				<div class="group relative flex flex-col items-center">
					<div
						class="absolute -inset-3 rounded-lg bg-white/5 opacity-0 transition-opacity duration-300
			   group-hover:opacity-100"
					></div>
					<div class="relative">
						<IconWithName
							name={item.name || resolvedIcon.name}
							icon={resolvedIcon.icon}
							invertFlag={$theme === 'light'}
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	:global(.tech-icon svg) {
		fill: currentColor;
		color: inherit;
		background: transparent !important;
	}

	:global(.tech-icon svg path) {
		fill: currentColor;
	}

	/* Optional: Add a subtle gradient animation to the background */
	div :global(.tech-container) {
		background: linear-gradient(45deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.06));
		background-size: 200% 200%;
		animation: gradient 15s ease infinite;
	}

	@keyframes gradient {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}
</style>
