<script>
	import { resumeModalOpen } from '../lib/stores/resumeModal.js';

	function openModal(event) {
		event.preventDefault();
		resumeModalOpen.set(true);
	}
</script>

<button
	on:click={openModal}
	class="outline-button w-full border-2 border-solid border-gray-900 px-6 py-3 text-gray-900 transition-colors duration-300
	hover:bg-gray-900 hover:text-white sm:px-7 sm:py-4
	dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-gray-900"
>
	View Resume
</button>

<style>
	.outline-button {
		border-radius: 50px;
	}
</style>
