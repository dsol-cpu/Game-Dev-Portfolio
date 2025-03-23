<script lang="ts">
	import { theme } from '../lib/stores/theme';

	$: bgClass = $theme === 'dark' ? 'bg-[#1C1C1C]' : 'bg-white';
	$: textClass = $theme === 'dark' ? 'text-white' : 'text-gray-800';
</script>

<div class={`h-full p-8 ${bgClass} ${textClass}`}>
	<h1 class="mb-6 text-3xl font-bold">Dashboard</h1>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		<div class="rounded-lg bg-blue-500 p-6 text-white">
			<h2 class="mb-2 text-xl font-semibold">Total Users</h2>
			<p class="text-4xl font-bold">1,245</p>
		</div>

		<div class="rounded-lg bg-green-500 p-6 text-white">
			<h2 class="mb-2 text-xl font-semibold">Active Projects</h2>
			<p class="text-4xl font-bold">42</p>
		</div>

		<div class="rounded-lg bg-purple-500 p-6 text-white">
			<h2 class="mb-2 text-xl font-semibold">New Messages</h2>
			<p class="text-4xl font-bold">18</p>
		</div>
	</div>

	<div class="mt-8">
		<h2 class="mb-4 text-2xl font-semibold">Recent Activity</h2>
		<div class={`border ${$theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} rounded-lg`}>
			<div class={`border-b p-4 ${$theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
				<p>Project "Moonshot" was updated</p>
				<p class="text-sm text-gray-500">2 hours ago</p>
			</div>
			<div class={`border-b p-4 ${$theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
				<p>New user registered: John Smith</p>
				<p class="text-sm text-gray-500">5 hours ago</p>
			</div>
			<div class="p-4">
				<p>Task "Design Homepage" completed</p>
				<p class="text-sm text-gray-500">Yesterday</p>
			</div>
		</div>
	</div>
</div>
