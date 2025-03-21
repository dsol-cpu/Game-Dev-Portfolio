<script lang="ts">
	import { theme } from '../lib/stores/theme';
	import { getTechIcon } from '../utils/techIcons';
	import type { Technology } from '../lib/types';
	import IconWithName from './IconWithName.svelte';

	export let companyLogo: string;
	export let companyName: string;
	export let logoStyle: string;
	export let position: string;
	export let description: string;
	export let technologies: Technology[];
	export let hoverEffect: boolean = true;

	$: bgClass = $theme === 'dark' ? 'bg-zinc-800' : 'bg-white';
	$: titleClass = $theme === 'dark' ? 'text-white' : 'text-gray-900';
	$: positionClass = $theme === 'dark' ? 'text-gray-300' : 'text-black-900';
	$: descriptionClass = $theme === 'dark' ? 'text-gray-400' : 'text-black-800';
</script>

<div
	class="group relative w-full max-w-4xl overflow-hidden rounded-2xl {bgClass} p-6 shadow-lg transition-all duration-300 hover:shadow-xl"
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
		<img
			src={companyLogo}
			alt={`${companyName} logo`}
			class="h-16 w-16 self-center rounded-lg object-contain transition-transform duration-500 group-hover:scale-105 sm:self-start"
			style={logoStyle}
		/>
		<div class="flex flex-1 flex-col space-y-2">
			<div class="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
				<h3 class="text-xl font-bold {titleClass}">{companyName}</h3>
			</div>
			<h4 class="text-lg {positionClass}">{position}</h4>
			{#if description}
				<p class={descriptionClass}>{description}</p>
			{/if}
			{#if technologies.length > 0}
				<div class="flex flex-wrap justify-center gap-6">
					{#each technologies as tech}
						{@const resolvedIcon = getTechIcon(tech.icon)}
						<IconWithName
							icon={resolvedIcon.icon}
							name={tech.name || resolvedIcon.name}
							iconSize={40}
							nameSize={13}
							invertFlag={$theme === 'light'}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
