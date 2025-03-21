export const ENV_CONFIG = {
	BACKEND_URL:
		import.meta.env.VITE_MODE === 'production'
			? import.meta.env.VITE_BACKEND_URL
			: 'http://localhost:10000',
	BACKEND_ROUTE: import.meta.env.VITE_BACKEND_ROUTE,
	GITHUB_API_ROUTE: import.meta.env.VITE_GITHUB_API_ROUTE,
	PAGE_VISIT_ROUTE_PATH: import.meta.env.VITE_PAGE_VISIT_ROUTE_PATH
} as const;

export const STATUS = {
	PROJECT: {
		COMPLETED: 'Completed',
		IN_PROGRESS: 'In Progress',
		MAINTAINED: 'Maintained'
	},
	DEPLOYMENT: {
		LIVE: 'Live',
		DEMO: 'Demo Available',
		LOCAL: 'Local Only'
	}
} as const;
