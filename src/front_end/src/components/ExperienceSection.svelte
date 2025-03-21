<script lang="ts">
	import TechCategory from './TechCategory.svelte';
	export let categories: TechCategory[];
</script>

<section class="mx-auto flex w-full max-w-7xl flex-col items-center px-4">
	<h class="mt-0 text-lg font-semibold tracking-[2.4px] text-stone-300 sm:mt-0 sm:text-xl">
		EXPERIENCE
	</h>
	<div class="mt-8 grid grid-cols-1 gap-8 sm:mt-12 md:grid-cols-3">
		{#each categories as category}
			<TechCategory title={category.title} items={category.items} />
		{/each}
	</div>
</section>
