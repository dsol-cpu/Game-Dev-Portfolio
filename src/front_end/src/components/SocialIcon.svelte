<script lang="ts">
	export let href: string;
	export let icon: string;
	export let label: string;
	export let size = '18px';
</script>

<a target="_blank" {href} aria-label={label} class="social-link">
	<img
		loading="lazy"
		src={icon}
		alt=""
		class="my-auto aspect-square shrink-0 self-stretch object-contain"
		style="width: {size}"
	/>
</a>

<style>
	.social-link {
		transition: opacity 0.2s ease-in-out;
	}
	.social-link:hover {
		opacity: 0.8;
	}
</style>
