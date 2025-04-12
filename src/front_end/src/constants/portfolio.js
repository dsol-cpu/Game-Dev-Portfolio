// Example update for constants/portfolio.js

export const CATEGORY_ID = {
  ALL: "all",
  GAME: "game",
  WEB: "web",
  MOBILE: "mobile",
  DESKTOP: "desktop",
  AR_VR: "ar_vr",
  BACKEND: "backend",
  FRONTEND: "frontend",
  FULLSTACK: "fullstack",
  UI_UX: "ui_ux",
  OPEN_SOURCE: "open_source",
  PROFESSIONAL: "professional",
  PERSONAL: "personal",
};

export const CATEGORIES = [
  {
    id: CATEGORY_ID.ALL,
    label: "All Projects",
    icon: "layout-grid",
  },
  {
    id: CATEGORY_ID.GAME,
    label: "Game Development",
    icon: "gamepad-2",
  },
  {
    id: CATEGORY_ID.WEB,
    label: "Web Development",
    icon: "globe",
  },
  {
    id: CATEGORY_ID.MOBILE,
    label: "Mobile Apps",
    icon: "smartphone",
  },
  {
    id: CATEGORY_ID.AR_VR,
    label: "AR/VR",
    icon: "glasses",
  },
  {
    id: CATEGORY_ID.AI,
    label: "AI & ML",
    icon: "brain",
  },
  {
    id: CATEGORY_ID.BACKEND,
    label: "Backend",
    icon: "server",
  },
  {
    id: CATEGORY_ID.FRONTEND,
    label: "Frontend",
    icon: "layout",
  },
  {
    id: CATEGORY_ID.FULLSTACK,
    label: "Full Stack",
    icon: "layers",
  },
  {
    id: CATEGORY_ID.UI_UX,
    label: "UI/UX Design",
    icon: "palette",
  },
  {
    id: CATEGORY_ID.OPEN_SOURCE,
    label: "Open Source",
    icon: "github",
  },
  {
    id: CATEGORY_ID.PROFESSIONAL,
    label: "Professional",
    icon: "briefcase",
  },
  {
    id: CATEGORY_ID.PERSONAL,
    label: "Personal Projects",
    icon: "heart",
  },
];

export const CATEGORY_LABELS = {
  [CATEGORY_ID.ALL]: "All",
  [CATEGORY_ID.GAME]: "Game",
  [CATEGORY_ID.WEB]: "Web",
  [CATEGORY_ID.MOBILE]: "Mobile",
  [CATEGORY_ID.DESKTOP]: "Desktop",
  [CATEGORY_ID.AR_VR]: "AR/VR",
  [CATEGORY_ID.AI]: "AI",
  [CATEGORY_ID.BACKEND]: "Backend",
  [CATEGORY_ID.FRONTEND]: "Frontend",
  [CATEGORY_ID.FULLSTACK]: "Full Stack",
  [CATEGORY_ID.UI_UX]: "UI/UX",
  [CATEGORY_ID.OPEN_SOURCE]: "Open Source",
  [CATEGORY_ID.PROFESSIONAL]: "Pro",
  [CATEGORY_ID.PERSONAL]: "Personal",
  default: "Project",
};

// Example of a portfolio item with multiple categories
export const PORTFOLIO_ITEMS = [
  {
    id: "game-engine",
    project: "Custom Game Engine",
    title: "3D Game Engine with Physics",
    // Primary category
    category: CATEGORY_ID.GAME,
    // Multiple categories - new field
    categories: [
      CATEGORY_ID.GAME,
      CATEGORY_ID.DESKTOP,
      CATEGORY_ID.OPEN_SOURCE,
    ],
    // Legacy subcategories field - kept for backward compatibility
    subcategories: [CATEGORY_ID.DESKTOP],
    company: "Self-Developed",
    period: "2022-2023",
    description:
      "A custom 3D game engine with physics simulation, rendering pipeline, and editor tools.",
    technologies: ["C++", "OpenGL", "GLSL", "Bullet Physics", "ImGui"],
    responsibilities: [
      "Developed a full 3D rendering pipeline with PBR materials",
      "Implemented physics integration with Bullet Physics",
      "Created an intuitive editor interface with ImGui",
    ],
    highlights: ["Featured on GitHub trending repositories"],
    demoUrl: "https://example.com/engine-demo",
    githubLink: "https://github.com/username/game-engine",
    modelConfig: {
      shape: "cube",
      color: 0x5e35b1,
      autoRotate: true,
      pulse: true,
    },
  },
  {
    id: "ar-game",
    project: "AR Mobile Game",
    title: "Augmented Reality Adventure",
    // Primary category
    category: CATEGORY_ID.GAME,
    // Multiple categories
    categories: [CATEGORY_ID.GAME, CATEGORY_ID.MOBILE, CATEGORY_ID.AR_VR],
    company: "GameStudio",
    period: "2023",
    description:
      "Mobile AR game that transforms real-world environments into interactive adventure playgrounds.",
    technologies: ["Unity", "AR Foundation", "C#", "Firebase", "Blender"],
    responsibilities: [
      "Lead developer for core AR mechanics and interactions",
      "Optimized for performance on mobile devices",
      "Integrated cloud save and multiplayer features",
    ],
    videoUrl: "https://example.com/ar-game-trailer",
    demoUrl: "https://example.com/ar-game",
    modelConfig: {
      shape: "sphere",
      color: 0x00b0ff,
      autoRotate: true,
    },
  },
  {
    id: "web-dashboard",
    project: "Analytics Dashboard",
    title: "Real-time Data Visualization Dashboard",
    // Primary category
    category: CATEGORY_ID.WEB,
    // Multiple categories
    categories: [
      CATEGORY_ID.WEB,
      CATEGORY_ID.FRONTEND,
      CATEGORY_ID.FULLSTACK,
      CATEGORY_ID.PROFESSIONAL,
    ],
    company: "DataCorp",
    period: "2023-Present",
    description:
      "Real-time analytics dashboard with interactive data visualization and customizable widgets.",
    technologies: [
      "React",
      "D3.js",
      "WebSockets",
      "Node.js",
      "MongoDB",
      "Tailwind CSS",
    ],
    responsibilities: [
      "Designed and implemented the front-end architecture",
      "Created responsive and interactive data visualizations",
      "Built real-time data streaming with WebSockets",
    ],
    demoUrl: "https://example.com/dashboard-demo",
    modelConfig: {
      shape: "cylinder",
      color: 0x26a69a,
      autoRotate: true,
    },
  },

  // Additional examples would follow the same pattern
];

export const STATS = {
  projects: PORTFOLIO_ITEMS.length,
  years: 8,
  clients: 15,
  awards: 5,
};
