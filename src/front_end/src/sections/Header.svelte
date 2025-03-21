<script>
	import { theme } from '../lib/stores/theme';
	import { resumeModalOpen } from '../lib/stores/resumeModal.js'; // Import store to control modal
	import ThemeToggle from '../components/ThemeToggle.svelte';

	$: headerClass = $theme === 'dark' ? 'bg-neutral-800/90 text-white' : 'bg-white/90 text-zinc-900';
	$: mobileMenuClass = $theme === 'dark' ? 'bg-neutral-800/90' : 'bg-white/90';
	$: hoverClass = $theme === 'dark' ? 'hover:bg-neutral-700' : 'hover:bg-gray-100';

	let isMenuOpen = false;

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function handleClickOutside(event) {
		const mobileMenu = document.getElementById('mobile-menu');
		const hamburgerButton = event.target.closest('button');

		if (!hamburgerButton && !mobileMenu?.contains(event.target)) {
			isMenuOpen = false;
		}
	}

	function openModal(event) {
		event.preventDefault(); // Prevent default link behavior
		resumeModalOpen.set(true); // Open the resume modal
	}
</script>

<svelte:window on:click={handleClickOutside} />

<header
	class="fixed left-0 right-0 top-0 z-50 flex w-full items-center justify-between px-4 py-3 backdrop-blur-sm transition-all duration-300 ease-in-out md:px-16 {headerClass}"
>
	<ThemeToggle />
	<button
		class="block rounded p-2 {hoverClass} focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
		on:click={toggleMenu}
		aria-labelledby="menu-button-text"
	>
		<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6h16M4 12h16M4 18h16"
			/>
		</svg>
	</button>

	<nav class="hidden w-full justify-end md:flex md:items-center md:gap-8">
		<a
			href="#home"
			class="relative font-medium transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-blue-400 after:transition-all after:duration-300 hover:text-blue-400 hover:after:w-full"
		>
			Home
		</a>
		<a
			href="#experience"
			class="relative font-medium transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-blue-400 after:transition-all after:duration-300 hover:text-blue-400 hover:after:w-full"
		>
			Experience
		</a>
		<a
			href="#projects"
			class="relative font-medium transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-blue-400 after:transition-all after:duration-300 hover:text-blue-400 hover:after:w-full"
		>
			Projects
		</a>

		<!-- Use button instead of a link for "Resume" -->
		<button
			class="relative font-medium transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-blue-400 after:transition-all after:duration-300 hover:text-blue-400 hover:after:w-full"
			on:click={openModal}
		>
			Resume
		</button>
	</nav>

	<div
		id="mobile-menu"
		class="absolute left-0 right-0 top-full {isMenuOpen
			? ''
			: 'hidden'} w-full py-2 shadow-lg backdrop-blur-sm md:hidden {mobileMenuClass}"
	>
		<nav class="flex flex-col space-y-2 px-4">
			<a
				href="#home"
				class="rounded-lg px-3 py-2 font-medium transition-colors duration-200 hover:bg-neutral-700"
				on:click={() => (isMenuOpen = false)}
			>
				Home
			</a>
			<a
				href="#experience"
				class="rounded-lg px-3 py-2 font-medium transition-colors duration-200 hover:bg-neutral-700"
				on:click={() => (isMenuOpen = false)}
			>
				Experience
			</a>
			<a
				href="#projects"
				class="rounded-lg px-3 py-2 font-medium transition-colors duration-200 hover:bg-neutral-700"
				on:click={() => (isMenuOpen = false)}
			>
				Projects
			</a>
			<button
				class="rounded-lg px-3 py-2 font-medium transition-colors duration-200 hover:bg-neutral-700"
				on:click={() => {
					isMenuOpen = false;
					openModal(event);
				}}
			>
				Resume
			</button>
		</nav>
	</div>
</header>
