import { createStore } from "solid-js/store";

// Store for project-model associations
const [projectModelMap, setProjectModelMap] = createStore({
  mappings: {},
  initialized: false,
});

// Initialize the mapping system
export const initializeProjectModelMapping = (options = {}) => {
  if (projectModelMap.initialized) return projectModelMap;

  // Default configuration
  const config = {
    defaultShape: "cube",
    useTechnologyMapping: true,
    useNameMapping: true,
    ...options,
  };

  // Load any existing mappings from storage
  loadStoredMappings();

  setProjectModelMap("initialized", true);
  return projectModelMap;
};

// Load stored mappings from localStorage if available
const loadStoredMappings = () => {
  try {
    const storedMappings = localStorage.getItem("projectModelMappings");
    if (storedMappings) {
      const mappings = JSON.parse(storedMappings);
      setProjectModelMap("mappings", mappings);
    }
  } catch (error) {
    console.warn("Failed to load stored model mappings", error);
  }
};

// Save current mappings to localStorage
const saveStoredMappings = () => {
  try {
    localStorage.setItem(
      "projectModelMappings",
      JSON.stringify(projectModelMap.mappings)
    );
  } catch (error) {
    console.warn("Failed to save model mappings", error);
  }
};

// Map a project to a specific model
export const mapProjectToModel = (projectId, modelName, shape = "cube") => {
  setProjectModelMap("mappings", projectId, { modelName, shape });
  saveStoredMappings();
};

// Get model for a specific project
export const getModelForProject = (project) => {
  // If we have a direct mapping, use it
  if (project.id && projectModelMap.mappings[project.id]) {
    return projectModelMap.mappings[project.id];
  }

  // Intelligent mapping based on project properties
  return inferModelFromProject(project);
};

// Infer appropriate model based on project attributes
const inferModelFromProject = (project) => {
  if (!project) return { shape: "cube" };

  // Technology-based mapping
  const techMapping = {
    react: { name: "react", shape: "cube" },
    angular: { name: "angular", shape: "cube" },
    vue: { name: "vue", shape: "cube" },
    node: { name: "node", shape: "cylinder" },
    python: { name: "python", shape: "cube" },
    java: { name: "java", shape: "cube" },
    docker: { name: "docker", shape: "cube" },
    aws: { name: "cloud", shape: "cone" },
    cloud: { name: "cloud", shape: "cone" },
    mobile: { name: "mobile", shape: "plane" },
    game: { name: "game", shape: "cube" },
    ai: { name: "ai", shape: "cube" },
    ml: { name: "ai", shape: "cube" },
    blockchain: { name: "blockchain", shape: "torus" },
    web3: { name: "blockchain", shape: "torus" },
    "3d": { name: "3d", shape: "cube" },
  };

  // Check technologies
  if (project.technologies && project.technologies.length > 0) {
    for (const tech of project.technologies) {
      const techLower = tech.toLowerCase();

      // Check for exact matches
      if (techMapping[techLower]) {
        return techMapping[techLower];
      }

      // Check for partial matches
      for (const [key, value] of Object.entries(techMapping)) {
        if (techLower.includes(key)) {
          return value;
        }
      }
    }
  }

  // Category-based mapping
  if (project.category) {
    const catLower = project.category.toLowerCase();

    // Check for category matches in tech mapping (reusing the same mappings)
    for (const [key, value] of Object.entries(techMapping)) {
      if (catLower.includes(key)) {
        return value;
      }
    }
  }

  // Map based on project name keywords
  if (project.title) {
    const titleLower = project.title.toLowerCase();
    const keywords = {
      game: { name: "game", shape: "cube" },
      mobile: { name: "mobile", shape: "plane" },
      web: { name: "web", shape: "cube" },
      app: { name: "app", shape: "cube" },
      dashboard: { name: "dashboard", shape: "plane" },
      analytics: { name: "chart", shape: "cylinder" },
      chat: { name: "chat", shape: "cube" },
      bot: { name: "robot", shape: "cube" },
      shop: { name: "shop", shape: "cube" },
      store: { name: "shop", shape: "cube" },
      portfolio: { name: "portfolio", shape: "cube" },
      blog: { name: "blog", shape: "plane" },
      "3d": { name: "3d", shape: "cube" },
    };

    for (const [key, value] of Object.entries(keywords)) {
      if (titleLower.includes(key)) {
        return value;
      }
    }
  }

  // Generate a consistent shape based on project ID
  const shapes = ["cube", "cube", "cylinder", "cone", "torus"];
  const titleHash = hashString(project.title || "");
  const shape = shapes[titleHash % shapes.length];

  // Return default fallback
  return { shape };
};

// String hashing function
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};
