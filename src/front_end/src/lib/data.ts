import { TechIcon } from '../utils/techIcons';
import type { Technology, ExperienceItem } from './types';

const createTech = (name: string, iconKey: TechIcon): Technology => ({
	name: name,
	icon: iconKey
});

const EXPERIENCE_DATA = {
	SWIFT: {
		technologies: [
			TechIcon.Cpp,
			TechIcon.Java,
			TechIcon.SpringBoot,
			TechIcon.Python,
			TechIcon.Bash,
			TechIcon.Perl,
			TechIcon.XML,
			TechIcon.Ansible,
			TechIcon.VSCode,
			TechIcon.IntelliJ,
			TechIcon.Jira,
			TechIcon.Bitbucket,
			TechIcon.Kibana,
			TechIcon.RHEL
		] as const,
		description: 'Contributing to the development of a new financial messaging format.'
	},
	GEOST: {
		technologies: [
			TechIcon.C,
			TechIcon.Python,
			TechIcon.Typescript,
			TechIcon.Docker,
			TechIcon.AWS,
			TechIcon.VSCode,
			TechIcon.Jira,
			TechIcon.Bitbucket
		] as const,
		description:
			"I developed satellite payload test software with NASA's Core Flight System (cFS) framework for controlling a camera payload in orbit as well as a ground interface to interface with and command it. Split into multiple dockerized microservices to process different Space Packet Protocol (SPP) data packet types (Commands, Command Responses, Telemetry)."
	},
	RAYTHEON: {
		technologies: [
			TechIcon.Java,
			TechIcon.Python,
			TechIcon.XML,
			TechIcon.Eclipse,
			TechIcon.Git,
			TechIcon.Centos,
			TechIcon.RHEL
		] as const,
		description:
			'I maintained the weather hazards alert system (AWIPS2) software in communication with National Weather Service (NWS) offices and meteorologists in the area.'
	}
} as const;

// Name mapping for display purposes
const techIconToName: Record<TechIcon, string> = {
	[TechIcon.C]: 'C',
	[TechIcon.CSharp]: 'C#',
	[TechIcon.Cpp]: 'C++',
	[TechIcon.Rust]: 'Rust',
	[TechIcon.Typescript]: 'TypeScript',
	[TechIcon.React]: 'React',
	[TechIcon.Svelte]: 'Svelte',
	[TechIcon.Python]: 'Python',
	[TechIcon.Java]: 'Java',
	[TechIcon.Docker]: 'Docker',
	[TechIcon.AWS]: 'AWS',
	[TechIcon.Ansible]: 'Ansible',
	[TechIcon.Bash]: 'Bash',
	[TechIcon.Bitbucket]: 'Bitbucket',
	[TechIcon.XML]: 'XML',
	[TechIcon.Eclipse]: 'Eclipse',
	[TechIcon.Git]: 'Git',
	[TechIcon.Centos]: 'CentOS',
	[TechIcon.RHEL]: 'RHEL',
	[TechIcon.Actix]: 'Actix',
	[TechIcon.Blender]: 'Blender',
	[TechIcon.PostgreSQL]: 'PostgreSQL',
	[TechIcon.GithubPages]: 'GitHub Pages',
	[TechIcon.Redis]: 'Redis',
	[TechIcon.MongoDB]: 'MongoDB',
	[TechIcon.JSON]: 'JSON',
	[TechIcon.Unity]: 'Unity',
	[TechIcon.Perl]: 'Perl',
	[TechIcon.SpringBoot]: 'Spring Boot',
	[TechIcon.Jira]: 'Jira',
	[TechIcon.VSCode]: 'VSCode',
	[TechIcon.IntelliJ]: 'IntelliJ',
	[TechIcon.Kibana]: 'Kibana'
};

export const experienceItems: ExperienceItem[] = [
	{
		companyLogo: 'SWIFT_logo.svg',
		companyName: 'SWIFT',
		position: 'Associate Developer/Systems Engineer',
		dateRange: 'January 2025 - Present',
		description: EXPERIENCE_DATA.SWIFT.description,
		technologies: EXPERIENCE_DATA.SWIFT.technologies.map((tech) =>
			createTech(tech === TechIcon.Bash ? 'Kornshell, Bash' : techIconToName[tech], tech)
		)
	},
	{
		companyLogo: 'geost_icon.svg',
		companyName: 'GEOST',
		position: 'Mission Systems Software Engineer',
		dateRange: 'April 2023 - August 2024',
		description: EXPERIENCE_DATA.GEOST.description,
		technologies: EXPERIENCE_DATA.GEOST.technologies.map((tech) =>
			createTech(techIconToName[tech], tech)
		)
	},
	{
		companyLogo: 'raytheon_icon.svg',
		companyName: 'Raytheon Technologies',
		position: 'Software Engineer',
		dateRange: 'August 2022 - April 2023',
		description: EXPERIENCE_DATA.RAYTHEON.description,
		technologies: EXPERIENCE_DATA.RAYTHEON.technologies.map((tech) =>
			createTech(techIconToName[tech], tech)
		)
	}
];

export const CATEGORY_DATA = [
	{
		TITLE: 'Systems & Embedded',
		ITEMS: [
			{ icon: 'C', name: 'C' },
			{ icon: 'Cpp', name: 'C++' },
			{ icon: 'Rust', name: 'Rust' }
		]
	},
	{
		TITLE: 'Frontend',
		ITEMS: [
			{ icon: 'Typescript', name: 'TypeScript' },
			{ icon: 'React', name: 'React' },
			{ icon: 'Svelte', name: 'Svelte' }
		]
	},
	{
		TITLE: 'Backend',
		ITEMS: [
			{ icon: 'Python', name: 'Python' },
			{ icon: 'Rust', name: 'Rust' }
		]
	}
] as const;

const PROJECTS = {
	PORTFOLIO: {
		title: 'Portfolio Website',
		imageUrl: 'portfolio_website_icon.svg',
		imageAlt: 'Portfolio Website',
		arrowIconUrl:
			'https://cdn.builder.io/api/v1/image/assets/TEMP/836107239b15f597b011636150c87b1fc753035a1ed4748bf7f038fd561d8903',
		githubUrl: 'https://github.com/dsol-cpu/SWE-Portfolio',
		description:
			"You're here! I wanted to better organize my portfolio website from the one I did in ReactJS a couple years ago, so here we are!",
		projectStatus: 'In Progress',
		deploymentStatus: 'Live',
		keyFeatures: ['Front-end', 'Back-end', 'RESTful API', 'Serverless'],
		technologies: [
			TechIcon.Svelte,
			TechIcon.Rust,
			TechIcon.Actix,
			TechIcon.GithubPages,
			TechIcon.Redis,
			TechIcon.MongoDB
		],
		demoUrl: 'https://dsol-cpu.github.io/SWE-Portfolio'
	},
	GEOSPATIAL: {
		title: 'Geospatial Mapping Challenge',
		imageUrl: 'https://img.youtube.com/vi/coCoAvOaSBM/0.jpg',
		imageAlt: '',
		arrowIconUrl:
			'https://cdn.builder.io/api/v1/image/assets/TEMP/887e7f1dfa4b2c0692cecd3fa55a4372355bafc71ae7d9ba75414ed4744a4ad4',
		githubUrl: 'https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024',
		description:
			'Parses a json file for geospatial data and uses a regex to deal with dirty/corrupted/invalid data. That data is correlated with each pin instantiated on the globe, allowing the user to mouse hover and display the corresponding location data.',
		projectStatus: 'Completed',
		deploymentStatus: 'Live',
		keyFeatures: ['Data Visualization', 'Game Development'],
		technologies: [TechIcon.Unity, TechIcon.CSharp, TechIcon.JSON, TechIcon.Blender],
		youtubeUrl: 'https://youtu.be/coCoAvOaSBM',
		demoUrl: 'https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/'
	},
	UFO: {
		title: 'UFO Sightings Challenge',
		imageUrl: 'alien_search_icon.svg',
		imageAlt: '',
		arrowIconUrl:
			'https://cdn.builder.io/api/v1/image/assets/TEMP/887e7f1dfa4b2c0692cecd3fa55a4372355bafc71ae7d9ba75414ed4744a4ad4',
		githubUrl: 'https://github.com/dsol-cpu/alien-search',
		description:
			'This was a challenge to gameify ufo sightings data. Extracts a number of random pieces of data and displays on UI near screens. Intended behavior was that all screens would amount to a password using the data and the ship would take that password, ending the game.',
		projectStatus: 'Completed',
		deploymentStatus: 'Live',
		keyFeatures: ['Data Visualization', 'Game Development'],
		technologies: [TechIcon.Unity, TechIcon.CSharp, TechIcon.JSON, TechIcon.Blender]
	},
	BLENDER_ADDON: {
		title: 'Moving Terrain Editor Addon (Mario Kart)',
		imageUrl: 'https://img.youtube.com/vi/QDt2I_BZKrI/0.jpg',
		imageAlt: 'Mario Kart Blender Addon',
		arrowIconUrl:
			'https://cdn.builder.io/api/v1/image/assets/TEMP/887e7f1dfa4b2c0692cecd3fa55a4372355bafc71ae7d9ba75414ed4744a4ad4',
		githubUrl: 'https://github.com/dsol-cpu/MK-AREAS-plugin',
		description:
			"Allows the user to import .kmp files and represent data as cube primitives, manipulate primitives' transform in Blender, and export transforms to manipulate their corresponding moving terrain (Conveyor belts, water current surfaces)",
		projectStatus: 'Completed',
		deploymentStatus: 'Local Only',
		keyFeatures: ['Data Visualization', 'Blender Addon'],
		technologies: [TechIcon.Blender, TechIcon.Python],
		youtubeUrl: 'https://www.youtube.com/watch?v=QDt2I_BZKrI'
	},
	MMORPG: {
		title: 'MMORPG Database & Interface',
		imageUrl: 'db_icon.svg',
		imageAlt: 'MMORPG Database and Interface',
		arrowIconUrl: '',
		githubUrl: 'https://github.com/dsol-cpu/MMORG-DB',
		description:
			'A small python CLI interface made for a mock MMORPG relational database postgreSQL',
		projectStatus: 'Completed',
		deploymentStatus: 'Local Only',
		keyFeatures: ['CLI', 'Database'],
		technologies: [TechIcon.Python, TechIcon.PostgreSQL]
	}
} as const;

export const projects = [
	{
		...PROJECTS.PORTFOLIO,
		technologies: PROJECTS.PORTFOLIO.technologies.map((tech) =>
			createTech(techIconToName[tech], tech)
		)
	},
	{
		...PROJECTS.GEOSPATIAL,
		technologies: PROJECTS.GEOSPATIAL.technologies.map((tech) =>
			createTech(techIconToName[tech], tech)
		)
	},
	{
		...PROJECTS.UFO,
		technologies: PROJECTS.UFO.technologies.map((tech) => createTech(techIconToName[tech], tech))
	},
	{
		...PROJECTS.BLENDER_ADDON,
		technologies: PROJECTS.BLENDER_ADDON.technologies.map((tech) =>
			createTech(tech === TechIcon.Blender ? 'Blender API' : techIconToName[tech], tech)
		)
	},
	{
		...PROJECTS.MMORPG,
		technologies: PROJECTS.MMORPG.technologies.map((tech) => createTech(techIconToName[tech], tech))
	}
];
