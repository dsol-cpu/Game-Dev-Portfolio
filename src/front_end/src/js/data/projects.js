// Enums
export const PortfolioCategory = Object.freeze({
  GODOT: "godot",
  UNREAL: "unreal",
  UNITY: "unity",
  WEB: "web",
  MOBILE: "mobile",
  GAME: "game",
});

export const TechTags = Object.freeze({
  UNITY: "Unity",
  CSHARP: "C#",
  CPP: "C++",
  PROCEDURAL: "Procedural Generation",
  REACT: "React",
  D3: "D3.js",
  API: "API",
});

// Portfolio data - format compatible with new project card implementation
export const PROJECT_CARD_DATA = [
  {
    id: "geospatial-visualizer",
    category: PortfolioCategory.UNITY,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNITY, TechTags.CSHARP],
    shortDescription: "A visualization of geospatial information.",
    demoUrl: "https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/",
    githubUrl:
      "https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024",
    modelName: "globe",
    imageUrl: "/images/me.png",
    imageAlt: "Geospatial Visualizer",
    fullDescription: [
      "A detailed visualization of geospatial information using Unity and C#.",
      "This project demonstrates advanced features for visualizing complex map data.",
    ],
  },
  {
    id: "geospatial-visualizer-2",
    category: PortfolioCategory.GODOT,
    title: "Geospatial Visualizer",
    tags: [TechTags.GODOT, TechTags.CPP],
    shortDescription: "A visualization of geospatial information.",
    demoUrl: "https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/",
    githubUrl:
      "https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024",
    modelName: "",
    imageUrl: "/images/me.png",
    imageAlt: "Geospatial Visualizer",
    fullDescription: [
      "A detailed visualization of geospatial information using Unity and C#.",
      "This project demonstrates advanced features for visualizing complex map data.",
    ],
  },
  {
    id: "geospatial-visualizer-3",
    category: PortfolioCategory.UNITY,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNITY, TechTags.CSHARP],
    shortDescription: "A visualization of geospatial information.",
    demoUrl: "https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/",
    githubUrl:
      "https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024",
    modelName: "",
    imageUrl: "/images/me.png",
    imageAlt: "Geospatial Visualizer",
    fullDescription: [
      "A detailed visualization of geospatial information using Unity and C#.",
      "This project demonstrates advanced features for visualizing complex map data.",
    ],
  },
  {
    id: "geospatial-visualizer-4",
    category: PortfolioCategory.UNITY,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNITY, TechTags.CSHARP],
    shortDescription: "A visualization of geospatial information.",
    demoUrl: "https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/",
    githubUrl:
      "https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024",
    modelName: "babyTurtle",
    imageUrl: "/images/me.png",
    imageAlt: "Geospatial Visualizer",
    fullDescription: [
      "A detailed visualization of geospatial information using Unity and C#.",
      "This project demonstrates advanced features for visualizing complex map data.",
    ],
  },
];
