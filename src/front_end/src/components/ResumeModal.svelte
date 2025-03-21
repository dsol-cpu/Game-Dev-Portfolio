<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { resumeModalOpen } from '../lib/stores/resumeModal.js';
	import { theme } from '../lib/stores/theme';
	import { browser } from '$app/environment';

	let modalContent;

	$: isDark = $theme === 'dark'; // Reactive theme check

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	function handleOverlayClick(event) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function handleOverlayKeydown(event) {
		// Close modal when pressing Enter or Space on the overlay
		if (event.key === 'Enter' || event.key === ' ') {
			closeModal();
		}
	}

	function closeModal() {
		resumeModalOpen.set(false);
		if (browser) {
			document.body.classList.remove('no-scroll');
		}
	}

	if (browser) {
		onMount(() => {
			resumeModalOpen.subscribe((value) => {
				document.body.classList.toggle('no-scroll', value);
			});
			window.addEventListener('keydown', handleKeydown);
		});

		onDestroy(() => {
			document.body.classList.remove('no-scroll');
			window.removeEventListener('keydown', handleKeydown);
		});
	}
</script>

{#if $resumeModalOpen}
	<div
		class="modal-overlay"
		aria-labelledby="modal-title"
		aria-hidden="false"
		transition:fade={{ duration: 200 }}
		on:click={handleOverlayClick}
		on:keydown={handleOverlayKeydown}
		role="button"
		tabindex="0"
	>
		<div
			class="modal-content {isDark ? 'dark' : 'light'}"
			role="document"
			transition:fly={{ y: 20, duration: 200 }}
			bind:this={modalContent}
		>
			<h2 id="modal-title" class="sr-only">Resume Modal</h2>
			<button
				class="close-button"
				type="button"
				aria-label="Close"
				on:click={() => resumeModalOpen.set(false)}
			>
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
					/>
				</svg>
			</button>

			<!-- Download button (now positioned at the top and slim) -->
			<a href="David_Solinsky_resume.pdf" download="David_Solinsky_resume.pdf">
				<button class="download-button" type="button">Download Resume</button>
			</a>

			<iframe src="David_Solinsky_resume.pdf" class="pdf-viewer" title="Resume PDF"></iframe>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		cursor: pointer;
		backdrop-filter: blur(5px);
		border: none;
		padding: 0;
		margin: 0;
	}

	.modal-overlay .modal-content {
		color: var(--modal-text);
		padding: 25px;
		border-radius: 12px;
		position: relative;
		width: 90%;
		max-width: 700px;
		height: 85vh;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		cursor: default;
		display: flex;
		flex-direction: column; /* Make it column layout */
	}

	.close-button {
		position: absolute;
		top: 15px;
		right: 15px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--close-btn-color);
		font-size: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-button svg {
		width: 100%;
		height: 100%;
	}

	.pdf-viewer {
		width: 100%;
		height: calc(100% - 50px); /* Adjust to allow room for the button */
		border: none;
	}

	.download-button {
		position: absolute;
		top: 15px; /* Position it at the top */
		left: 50%;
		transform: translateX(-50%);
		padding: 5px 15px;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.3s ease;
		z-index: 10; /* Ensure it's above the PDF viewer */
	}

	.download-button:hover {
		background-color: #0056b3;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	:global(.modal-open) {
		overflow: hidden;
		height: 100vh;
		position: fixed;
		width: 100%;
	}

	:root {
		--modal-bg: white;
		--modal-text: black;
		--close-btn-color: rgba(0, 0, 0, 0.5);
	}

	/* Dark theme styles */
	:global([data-theme='dark']) {
		--modal-bg: #222;
		--modal-text: #eee;
		--close-btn-color: rgba(255, 255, 255, 0.6);
	}

	/* Light theme styles */
	:global([data-theme='light']) {
		--modal-bg: white;
		--modal-text: black;
		--close-btn-color: rgba(0, 0, 0, 0.5);
	}

	:global(.no-scroll) {
		overflow: hidden;
		height: 100%;
		position: fixed;
		width: 100%;
	}
</style>
