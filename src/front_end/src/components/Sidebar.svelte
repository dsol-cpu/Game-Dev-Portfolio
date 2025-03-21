<script>
	import { theme } from '../lib/stores/theme';

	export let isOpen = false;
	export let position = 'left';
	export let width = '280px';
	export let toggleButton = true;

	// Game-inspired theme classes
	$: sidebarClass = $theme === 'dark'
		? 'bg-slate-900 text-green-300 border-cyan-700 bg-gradient-to-b from-slate-900 to-blue-900/40'
		: 'bg-slate-100 text-slate-800 border-emerald-400 bg-gradient-to-b from-slate-100 to-teal-200/50';
	
	$: itemClass = $theme === 'dark'
		? 'hover:bg-blue-800/40 hover:text-yellow-300'
		: 'hover:bg-emerald-200/60 hover:text-blue-800';
	
	$: activeClass = $theme === 'dark' 
		? 'bg-blue-900/60 text-green-400 border-l-4 border-green-500' 
		: 'bg-teal-200/70 text-blue-900 border-l-4 border-blue-600';

	// Current active section
	let activeSection = 'home';
	
	// Handle outside clicks to close sidebar on mobile
	function handleClickOutside(event) {
		if (isOpen && 
			!event.target.closest('.sidebar') && 
			!event.target.closest('.sidebar-toggle')) {
			isOpen = false;
		}
	}

	// Toggle sidebar
	function toggleSidebar() {
		isOpen = !isOpen;
	}

	// Handle navigation click
	function handleNavClick(section) {
		activeSection = section;
		if (window.innerWidth < 768) {
			isOpen = false;
		}
	}

	// Open resume modal
	function openResumeModal() {
		import('../lib/stores/resumeModal.js').then((module) => {
			module.resumeModalOpen.set(true);
		});
		
		if (window.innerWidth < 768) {
			isOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

{#if toggleButton}
	<button
		class="sidebar-toggle fixed top-16 {position === 'left' ? 'left-4' : 'right-4'} z-40 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 p-2 text-white shadow-lg hover:from-blue-500 hover:to-teal-400 md:hidden"
		on:click={toggleSidebar}
		aria-label="Toggle sidebar"
	>
		<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			{#if isOpen}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
			{/if}
		</svg>
	</button>
{/if}

<aside
	class="sidebar fixed top-0 {position === 'left' ? 'left-0' : 'right-0'} z-30 h-full border-r shadow-lg {sidebarClass}"
	style="width: {width}; transform: translateX({isOpen || window.innerWidth >= 768 ? '0' : position === 'left' ? '-100%' : '100%'}); transition: transform 0.3s ease;"
>
	<div class="flex h-full flex-col pt-16">
		<div class="border-b border-cyan-500/30 px-6 py-6">
			<h2 class="text-2xl font-bold">
				{#if $theme === 'dark'}
					<span class="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">David Solinsky</span>
				{:else}
					<span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-teal-600">David Solinsky</span>
				{/if}
			</h2>
			<p class="mt-1 text-sm opacity-80">Game Developer & Designer</p>
		</div>

		<nav class="flex-1 overflow-y-auto px-4">
			<ul class="space-y-2 py-4">
				{#each ['home', 'experience', 'projects'] as section}
					<li>
						<a
							href={'#' + section}
							class="flex items-center rounded-lg px-4 py-3 font-medium transition-all duration-200 {activeSection === section ? activeClass : itemClass}"
							on:click={() => handleNavClick(section)}
						>
							<!-- Gaming-inspired icons -->
							<span class="mr-3">
								{#if section === 'home'}
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
									</svg>
								{:else if section === 'experience'}
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
									</svg>
								{:else if section === 'projects'}
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
									</svg>
								{/if}
							</span>
							<span class="capitalize">{section}</span>
						</a>
					</li>
				{/each}
				<li>
					<button
						class="flex w-full items-center rounded-lg px-4 py-3 font-medium transition-all duration-200 {itemClass}"
						on:click={openResumeModal}
					>
						<span class="mr-3">
							<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>
							</svg>
						</span>
						<span>Resume</span>
					</button>
				</li>
			</ul>
		</nav>
		
		<!-- Game-inspired footer -->
		<div class="border-t border-cyan-500/30 p-4 text-xs text-center opacity-70">
			<span>LEVEL 100 • DEV BUILD v2.5</span>
		</div>
	</div>
</aside>