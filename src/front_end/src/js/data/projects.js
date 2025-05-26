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
  UNREAL: "Unreal",
  GODOT: "Godot",
  CSHARP: "C#",
  CPP: "C++",
  PROCEDURAL: "Procedural Generation",
  REACT: "React",
  D3: "D3.js",
  API: "API",
  BLENDER: "Blender",
  ASEPRITE: "Aseprite",
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
    sourceUrl:
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
    id: "broadside",
    category: PortfolioCategory.GODOT,
    title: "Broadside",
    tags: [TechTags.GODOT, TechTags.CPP],
    shortDescription:
      "A roguelike on the open seas where you defeat towers and collect upgrades.",
    sourceUrl: "https://smeppu.itch.io/broadside",
    modelName: "broadsideShip",
    imageUrl: "/images/me.png",
    imageAlt: "Broadside",
    fullDescription: [
      "This was a submission for the game jam for charity: Mini Code for a Cause.",
    ],
  },
  {
    id: "geospatial-visualizer-3",
    category: PortfolioCategory.UNREAL,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNREAL, TechTags.BLENDER, TechTags.ASEPRITE],
    shortDescription:
      "Open-seas Roguelike made for the Mini Code for a Cause Charity Game Jam.",
    sourceUrl:
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
    sourceUrl:
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
