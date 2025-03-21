<script lang="ts">
	import { theme } from '../lib/stores/theme';
	import { CATEGORY_DATA } from '../lib/data';
	import { getTechIcon } from '../utils/techIcons';
	import IconWithName from './IconWithName.svelte';

	export const languageCategories = CATEGORY_DATA;

	$: bgClass = $theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100';
	$: textClass = $theme === 'dark' ? 'text-white' : 'text-gray-900';
</script>

<div class="mb-12 flex justify-center">
	<div class="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
		{#each languageCategories as category}
			<div class="flex flex-col items-center gap-6 rounded-lg {bgClass} p-6 shadow-lg">
				<h3 class="text-center text-xl font-bold {textClass}">{category.TITLE}</h3>
				<div class="flex flex-wrap justify-center gap-6">
					{#each category.ITEMS as tech}
						{@const resolvedIcon = getTechIcon(tech.icon)}
						<IconWithName
							icon={resolvedIcon.icon}
							name={tech.name}
							iconSize={48}
							invertFlag={$theme === 'light'}
						/>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
