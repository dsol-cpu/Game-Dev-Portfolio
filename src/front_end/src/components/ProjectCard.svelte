<script lang="ts">
	import { theme } from '../lib/stores/theme';
	import { STATUS } from '../lib/constants';
	import IconWithName from './IconWithName.svelte';
	import type { Technology } from '../lib/types';
	import { getTechIcon } from '../utils/techIcons';

	$: themeClass = $theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900';
	$: hoverClass = $theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-gray-50';

	type ProjectStatus = (typeof STATUS.PROJECT)[keyof typeof STATUS.PROJECT];
	type DeploymentStatus = (typeof STATUS.DEPLOYMENT)[keyof typeof STATUS.DEPLOYMENT];

	// Props
	export let title: string;
	export let imageUrl: string;
	export let imageAlt: string;
	export let githubUrl: string;
	export let href: string;
	export let description: string;
	export let technologies: Technology[] = []; // Changed from string[] to Technology[]
	export let projectStatus: string;
	export let deploymentStatus: string;
	export let keyFeatures: string[] = [];
	export let role: string = '';
	export let youtubeUrl: string = '';
	export let demoUrl: string = '';
	export let last_updated_at: string = '';

	// Validate statuses
	let validatedProjectStatus: ProjectStatus = projectStatus as ProjectStatus;
	let validatedDeploymentStatus: DeploymentStatus = deploymentStatus as DeploymentStatus;

	// Format date helper function
	const formatDate = (dateString: string): string => {
		try {
			return new Date(dateString).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short'
			});
		} catch {
			return 'Unknown date';
		}
	};

	// Get status color classes
	const getProjectStatusColor = (status: ProjectStatus): string => {
		const colors = {
			[STATUS.PROJECT.COMPLETED]: 'bg-green-500/20 text-green-300',
			[STATUS.PROJECT.IN_PROGRESS]: 'bg-blue-500/20 text-blue-300',
			[STATUS.PROJECT.MAINTAINED]: 'bg-purple-500/20 text-purple-300'
		};
		return colors[status] ?? colors[STATUS.PROJECT.IN_PROGRESS];
	};

	const getDeploymentStatusColor = (status: DeploymentStatus): string => {
		const colors = {
			[STATUS.DEPLOYMENT.LIVE]: 'bg-emerald-500/20 text-emerald-300',
			[STATUS.DEPLOYMENT.DEMO]: 'bg-yellow-500/20 text-yellow-300',
			[STATUS.DEPLOYMENT.LOCAL]: 'bg-gray-500/20 text-gray-300'
		};
		return colors[status] ?? colors[STATUS.DEPLOYMENT.LOCAL];
	};
</script>

<article
	class="group relative h-auto min-h-[28rem] w-full overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl"
	class:bg-zinc-800={$theme === 'dark'}
	class:text-white={$theme === 'dark'}
	class:bg-white={$theme !== 'dark'}
	class:text-zinc-900={$theme !== 'dark'}
	class:hover\:bg-zinc-700={$theme === 'dark'}
	class:hover\:bg-gray-50={$theme !== 'dark'}
>
	<a {href} target="_blank" rel="noopener noreferrer" class="block h-48 overflow-hidden">
		<img
			loading="lazy"
			src={imageUrl}
			alt={imageAlt}
			class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
		/>
	</a>
	<div class="flex flex-col justify-between p-4 sm:p-6">
		<div class="space-y-4">
			<div class="flex items-start justify-between">
				<h3
					class="flex-1 text-lg font-bold {$theme === 'dark'
						? 'text-white'
						: 'text-zinc-900'} sm:text-xl"
				>
					{title}
				</h3>
				<div class="relative">
					<div class="absolute right-0 top-0 flex flex-col items-end space-y-2">
						{#if githubUrl}
							<a
								href={githubUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700/50 p-2 transition-all duration-300 hover:bg-zinc-600/50"
								aria-label="View source on GitHub"
							>
								<img
									src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg"
									alt="GitHub"
									class="h-6 w-6 transition-all duration-300 hover:scale-[1.02] group-hover:brightness-125"
								/>
							</a>
						{/if}

						{#if youtubeUrl}
							<a
								href={youtubeUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700/50 p-2 transition-all duration-300 hover:bg-zinc-600/50"
								aria-label="Watch demo on YouTube"
							>
								<svg class="h-6 w-6 fill-current text-red-500" viewBox="0 0 24 24">
									<path
										d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"
									/>
								</svg>
							</a>
						{/if}

						{#if demoUrl}
							<a
								href={demoUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700/50 p-2 transition-all duration-300 hover:bg-zinc-600/50"
								aria-label="View live demo"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
									/>
								</svg>
							</a>
						{/if}
					</div>
				</div>
			</div>

			<!-- Project metadata -->
			<div class="flex flex-wrap gap-2 text-xs">
				<span
					class="rounded-full px-2 py-1 {getProjectStatusColor(validatedProjectStatus)} {$theme ===
					'dark'
						? 'text-white'
						: 'text-zinc-900'}"
				>
					{validatedProjectStatus}
				</span>
				<span
					class="rounded-full px-2 py-1 {getDeploymentStatusColor(
						validatedDeploymentStatus
					)} {$theme === 'dark' ? 'text-white' : 'text-zinc-900'}"
				>
					{validatedDeploymentStatus}
				</span>
				{#if last_updated_at}
					<span class="rounded-full bg-purple-500/20 px-2 py-1 text-purple-300">
						Updated {formatDate(last_updated_at)}
					</span>
				{/if}
			</div>

			<!-- Description -->
			<p class="text-sm {$theme === 'dark' ? 'text-gray-300' : 'text-zinc-700'}">
				{description}
			</p>
			<!-- Technologies -->
			<div class="space-y-2">
				<div class="flex items-center justify-center gap-4">
					<!-- Added justify-center and items-center -->
					{#each technologies as tech}
						{@const resolvedIcon = getTechIcon(tech.icon)}
						<IconWithName
							icon={resolvedIcon.icon}
							name={tech.name || resolvedIcon.name}
							iconSize={24}
							nameSize={12}
							invertFlag={$theme === 'light'}
						/>
					{/each}
				</div>
			</div>

			<!-- Key Features -->
			<div class="space-y-2">
				<h4 class="text-sm font-semibold {$theme === 'dark' ? 'text-gray-400' : 'text-zinc-800'}">
					Key Features
				</h4>
				<ul
					class="list-inside list-disc space-y-1 text-sm {$theme === 'dark'
						? 'text-gray-300'
						: 'text-zinc-800'}"
				>
					{#each keyFeatures as feature}
						<li class={$theme === 'dark' ? 'text-gray-300' : 'text-zinc-800'}>{feature}</li>
					{/each}
				</ul>
			</div>

			<!-- Role information if provided -->
			{#if role}
				<div class="text-sm {$theme === 'dark' ? 'text-gray-400' : 'text-zinc-600'}">
					<span class="font-semibold">Role:</span>
					{role}
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	article::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.1) 100%);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
		border-radius: 1rem;
	}

	article:hover::after {
		opacity: 1;
	}
</style>
