<script lang="ts">
	import { theme } from '../lib/stores/theme';
	export let icon: string;
	export let name: string;
	export let hoverEffect: boolean = true;
	export let iconSize: number = 40;
	export let nameSize: number = 16;
	$: textClass = $theme === 'dark' ? 'text-white' : 'text-gray-900';
</script>

<div class="icon-container {hoverEffect ? '' : 'no-hover-effect'}">
	<img
		loading="lazy"
		src={icon}
		alt={name}
		class="icon"
		style="width: {iconSize}px; height: {iconSize}px;"
	/>
	<span class="icon-name {textClass}" style="font-size: {nameSize}px">{name}</span>
</div>

<style>
	.icon-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.icon {
		object-fit: contain;
		transition: transform 0.1s ease-in-out;
	}
	.icon-container:hover .icon {
		transform: scale(var(--scale-factor, 1.1));
	}
	:global(.no-hover-effect) .icon-container:hover .icon {
		transform: none;
	}
	.icon-name {
		margin-top: 4px;
	}
</style>
