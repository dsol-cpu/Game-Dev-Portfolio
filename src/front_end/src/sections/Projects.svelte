<script lang="ts">
	import ProjectCard from '../components/ProjectCard.svelte';
	import IconWithName from '../components/IconWithName.svelte';
	import { ENV_CONFIG } from '../lib/constants';
	import { projects } from '../lib/data';
	import type { Project, GitHubInfo } from '../lib/types';
	import { theme } from '../lib/stores/theme';
	$: textClass = $theme === 'dark' ? 'text-stone-300' : 'text-zinc-900';

	let projectsData: Project[] = projects;

	async function fetchGitHubInfo() {
		try {
			const response = await fetch(
				`${ENV_CONFIG.BACKEND_URL}${ENV_CONFIG.BACKEND_ROUTE}${ENV_CONFIG.GITHUB_API_ROUTE}`,
				{
					method: 'GET',
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch GitHub info');
			}

			const data: GitHubInfo[] = await response.json();

			projectsData = projectsData.map((project) => {
				const repoName = project.githubUrl.split('/').pop();
				const repoInfo = data.find((info) => info.name === repoName);
				return {
					...project,
					last_updated_at: repoInfo?.last_updated_at
				};
			});
		} catch (error) {
			console.error('Error fetching GitHub info:', error);
		}
	}

	import { onMount } from 'svelte';
	onMount(() => {
		//TODO: This is where I communicate with my backend
		// fetchGitHubInfo();
	});
</script>

<section id="projects" class="styled-section mb-16 flex flex-col items-center rounded-lg p-6">
	<h class="mt-0 text-lg font-semibold tracking-[2.4px] text-stone-300 sm:mt-0 sm:text-xl">
		PROJECTS
	</h>
	<div class="mt-7 w-full max-w-5xl px-4">
		<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each projectsData as project (project.title)}
				<ProjectCard {...project}>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each project.technologies as tech (tech.name)}
							<IconWithName icon={tech.icon} name={tech.name} iconSize={24} nameSize={12} />
						{/each}
					</div>
				</ProjectCard>
			{/each}
		</div>
	</div>
</section>

<style>
	@import '../lib/styles/styles.css';
</style>
