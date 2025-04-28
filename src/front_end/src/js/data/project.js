/**
 * @fileoverview Project card data for portfolio site.
 * Contains all portfolio projects information.
 */

// Enums
export const PortfolioCategory = Object.freeze({
  UNITY: "unity",
  WEB: "web",
  GODOT: "godot",
  MOBILE: "mobile",
  GAME: "game",
});

export const TechTags = Object.freeze({
  UNITY: "Unity",
  CSHARP: "C#",
  PROCEDURAL: "Procedural Generation",
  REACT: "React",
  D3: "D3.js",
  API: "API",
});

// Portfolio data - format compatible with new project card implementation
export const projectCardData = [
  {
    id: "geospatial-visualizer",
    category: PortfolioCategory.GODOT,
    title: "Geospatial Visualizer",
    tags: [TechTags.GODOT, TechTags.CSHARP],
    shortDescription: "A visualization of geospatial information.",
    demoUrl: "https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/",
    githubUrl:
      "https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024",
    modelName: "babyTurtle",
    imageUrl: "",
    imageAlt: "Geospatial Visualizer",
    fullDescription: [
      "A detailed visualization of geospatial information using Unity and C#.",
      "This project demonstrates advanced features for visualizing complex map data.",
    ],
  },
  {
    id: "geospatial-visualizer-2",
    category: PortfolioCategory.UNITY,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNITY, TechTags.CSHARP],
    shortDescription: "A visualization of geospatial information.",
    demoUrl: "https://dsol-cpu.github.io/GeospatialDataVisualization-Aug2024/",
    githubUrl:
      "https://github.com/dsol-cpu/GeospatialDataVisualization-Aug2024",
    modelName: "babyTurtle",
    imageUrl: "",
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
    modelName: "babyTurtle",
    imageUrl: "",
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
    imageUrl: "",
    imageAlt: "Geospatial Visualizer",
    fullDescription: [
      "A detailed visualization of geospatial information using Unity and C#.",
      "This project demonstrates advanced features for visualizing complex map data.",
    ],
  },
];
