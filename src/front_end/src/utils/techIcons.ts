export enum TechIcon {
	C = 'C',
	CSharp = 'CSharp',
	Cpp = 'Cpp',
	Rust = 'Rust',
	Typescript = 'Typescript',
	React = 'React',
	Svelte = 'Svelte',
	Python = 'Python',
	Java = 'Java',
	Docker = 'Docker',
	AWS = 'AWS',
	Ansible = 'Ansible',
	Bash = 'Bash',
	Jira = 'Jira',
	Bitbucket = 'Bitbucket',
	XML = 'XML',
	Eclipse = 'Eclipse',
	Git = 'Git',
	Centos = 'CentOS',
	RHEL = 'RHEL',
	Actix = 'Actix',
	Blender = 'Blender',
	PostgreSQL = 'PostgreSQL',
	GithubPages = 'GitHubPages',
	Redis = 'Redis',
	MongoDB = 'MongoDB',
	JSON = 'JSON',
	Unity = 'Unity',
	Perl = 'Perl',
	SpringBoot = 'SpringBoot',
	VSCode = 'VSCode',
	IntelliJ = 'IntelliJ',
	Kibana = 'Kibana'
}

const BASE_DEVICON_URL = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons';
const BASE_YESICON_URL = 'https://api.iconify.design';

// Define fallback icon from a known working source
const FALLBACK_ICON = `${BASE_DEVICON_URL}/javascript/javascript-original.svg`;

export const TECH_ICONS: Record<TechIcon, { icon: string; name: string }> = {
	[TechIcon.C]: { icon: `${BASE_DEVICON_URL}/c/c-original.svg`, name: 'C' },
	[TechIcon.CSharp]: { icon: `${BASE_DEVICON_URL}/csharp/csharp-original.svg`, name: 'C#' },
	[TechIcon.Cpp]: { icon: `${BASE_DEVICON_URL}/cplusplus/cplusplus-original.svg`, name: 'C++' },
	[TechIcon.Rust]: { icon: 'rust_icon.svg', name: 'Rust' },
	[TechIcon.Typescript]: {
		icon: `${BASE_DEVICON_URL}/typescript/typescript-original.svg`,
		name: 'TypeScript'
	},
	[TechIcon.React]: { icon: `${BASE_DEVICON_URL}/react/react-original.svg`, name: 'React' },
	[TechIcon.Svelte]: { icon: `${BASE_DEVICON_URL}/svelte/svelte-original.svg`, name: 'Svelte' },
	[TechIcon.Python]: { icon: `${BASE_DEVICON_URL}/python/python-original.svg`, name: 'Python' },
	[TechIcon.Java]: { icon: `${BASE_DEVICON_URL}/java/java-original.svg`, name: 'Java' },
	[TechIcon.Docker]: { icon: `${BASE_DEVICON_URL}/docker/docker-original.svg`, name: 'Docker' },
	[TechIcon.AWS]: {
		icon: `${BASE_DEVICON_URL}/amazonwebservices/amazonwebservices-original-wordmark.svg`,
		name: 'AWS'
	},
	[TechIcon.Ansible]: { icon: `${BASE_DEVICON_URL}/ansible/ansible-original.svg`, name: 'Ansible' },
	[TechIcon.Bash]: { icon: `${BASE_DEVICON_URL}/bash/bash-original.svg`, name: 'Bash' },
	[TechIcon.Jira]: { icon: `${BASE_DEVICON_URL}/jira/jira-original-wordmark.svg`, name: 'Jira' },
	[TechIcon.Bitbucket]: {
		icon: `${BASE_DEVICON_URL}/bitbucket/bitbucket-original.svg`,
		name: 'Bitbucket'
	},
	[TechIcon.XML]: { icon: `${BASE_DEVICON_URL}/xml/xml-original.svg`, name: 'XML' },
	[TechIcon.Eclipse]: { icon: `${BASE_DEVICON_URL}/eclipse/eclipse-original.svg`, name: 'Eclipse' },
	[TechIcon.Git]: { icon: `${BASE_DEVICON_URL}/git/git-original.svg`, name: 'Git' },
	[TechIcon.Centos]: { icon: `${BASE_DEVICON_URL}/centos/centos-original.svg`, name: 'CentOS' },
	[TechIcon.RHEL]: { icon: `${BASE_DEVICON_URL}/redhat/redhat-original.svg`, name: 'RHEL' }, // Use devicon instead of local file
	[TechIcon.Actix]: { icon: `${BASE_YESICON_URL}/simple-icons:actix.svg`, name: 'Actix' },
	[TechIcon.Blender]: { icon: `${BASE_DEVICON_URL}/blender/blender-original.svg`, name: 'Blender' },
	[TechIcon.PostgreSQL]: {
		icon: `${BASE_DEVICON_URL}/postgresql/postgresql-original.svg`,
		name: 'PostgreSQL'
	},
	[TechIcon.GithubPages]: {
		icon: `${BASE_DEVICON_URL}/github/github-original.svg`,
		name: 'GitHub Pages'
	},
	[TechIcon.Redis]: { icon: `${BASE_DEVICON_URL}/redis/redis-original.svg`, name: 'Redis' },
	[TechIcon.MongoDB]: {
		icon: `${BASE_DEVICON_URL}/mongodb/mongodb-original-wordmark.svg`,
		name: 'MongoDB'
	},
	[TechIcon.JSON]: { icon: `${BASE_DEVICON_URL}/json/json-original.svg`, name: 'JSON' },
	[TechIcon.Unity]: { icon: `${BASE_DEVICON_URL}/unity/unity-original.svg`, name: 'Unity' },
	[TechIcon.Perl]: { icon: `${BASE_DEVICON_URL}/perl/perl-original.svg`, name: 'Perl' },
	[TechIcon.SpringBoot]: {
		icon: `${BASE_DEVICON_URL}/spring/spring-original.svg`,
		name: 'Spring Boot'
	},
	[TechIcon.VSCode]: {
		icon: `${BASE_DEVICON_URL}/vscode/vscode-original-wordmark.svg`,
		name: 'VSCode'
	},
	[TechIcon.IntelliJ]: {
		icon: `${BASE_DEVICON_URL}/intellij/intellij-original.svg`,
		name: 'IntelliJ'
	},
	[TechIcon.Kibana]: {
		icon: `${BASE_DEVICON_URL}/kibana/kibana-original.svg`,
		name: 'Kibana'
	}
};

// Define a return type for consistency
type IconResult = {
	icon: string;
	name: string;
};

// Create a type guard to check if a value is a valid TechIcon
function isTechIcon(value: unknown): value is TechIcon {
	return Object.values(TechIcon).includes(value as TechIcon);
}

export function getTechIcon(
	iconInput: TechIcon | string | { icon: string; name: string },
	customName?: string
): IconResult {
	try {
		// Handle the case where an object is passed
		if (typeof iconInput === 'object' && iconInput !== null && 'icon' in iconInput) {
			return {
				icon: iconInput.icon || FALLBACK_ICON,
				name: customName ?? (iconInput.name || 'Unknown Technology')
			};
		}

		// Handle string values that might match enum keys
		if (typeof iconInput === 'string') {
			// Try to convert string to enum value
			const enumValue = Object.values(TechIcon).find((val) => val === iconInput);
			if (enumValue && isTechIcon(enumValue)) {
				const data = TECH_ICONS[enumValue];
				return {
					icon: data.icon,
					name: customName ?? data.name
				};
			}
		}

		// Handle direct enum values
		if (isTechIcon(iconInput) && TECH_ICONS[iconInput]) {
			const data = TECH_ICONS[iconInput];
			return {
				icon: data.icon,
				name: customName ?? data.name
			};
		}

		// Return default for any invalid input
		console.warn('Unknown technology icon:', iconInput);
		return {
			icon: FALLBACK_ICON,
			name: customName ?? 'Unknown Technology'
		};
	} catch (error) {
		console.error('Error in getTechIcon:', error);
		return {
			icon: FALLBACK_ICON,
			name: customName ?? 'Unknown Technology'
		};
	}
}
