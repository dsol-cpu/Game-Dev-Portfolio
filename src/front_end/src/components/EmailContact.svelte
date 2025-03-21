<script lang="ts">
	import { theme } from '../lib/stores/theme';

	interface EmailProps {
		email: string;
		icon: string;
	}

	export let email: EmailProps['email'];
	export let icon: EmailProps['icon'];

	$: textClass =
		$theme === 'dark' ? 'text-stone-300 hover:text-white' : 'text-gray-700 hover:text-gray-900';
</script>

<div class="flex w-full items-center justify-center gap-2 lg:justify-start">
	<img
		src={icon}
		alt="Email Icon"
		loading="lazy"
		class="h-[17px] w-[17px] object-contain"
		style={$theme === 'light' ? 'filter: invert(0.7);' : ''}
	/>
	<a
		href="mailto:{email}"
		class="text-sm font-semibold tracking-wide transition-colors duration-200 {textClass}"
	>
		{email}
	</a>
</div>

<style lang="postcss">
	a:focus-visible {
		@apply outline-2 outline-offset-2;
		outline-color: currentColor;
	}
</style>
