import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { createThemeManager } from "../stores/theme";
import ProjectCard from "./ProjectCard";
import * as THREE from "three";

const CATEGORY_ID = {
  ALL: 0,
  SHIPPED: 1,
  PROFESSIONAL: 2,
};

const CATEGORIES = [
  { id: CATEGORY_ID.ALL, label: "All Projects" },
  { id: CATEGORY_ID.SHIPPED, label: "Shipped Games" },
  { id: CATEGORY_ID.PROFESSIONAL, label: "Professional Work" },
];

const CATEGORY_LABELS = {
  [CATEGORY_ID.SHIPPED]: "Shipped Game",
  [CATEGORY_ID.PROFESSIONAL]: "Professional Work",
  default: "Personal Project",
};

const EXPERIENCES = [
  {
    id: 1,
    title: "Gameplay Programmer",
    project: "Quick Quisine",
    company: "Indie Studio",
    period: "2021",
    description:
      "WarioWare-like cooking game featuring fast-paced minigames and quirky characters.",
    category: CATEGORY_ID.SHIPPED,
    responsibilities: [
      "Implemented DDR-like rhythm cooking minigame using SFML",
      "Created game art assets and animations",
      "Designed core gameplay mechanics and scoring system",
    ],
    technologies: ["SFML", "C++", "Git", "CMake"],
    modelId: "babyTurtle",
    // imageUrl: "/assets/images/quick-quisine.jpg",
    // videoLink: "https://example.com/quick-quisine-video",
    // storeLink: "https://store.example.com/quick-quisine",
    // githubLink: "https://github.com/example/quick-quisine",
  },
  // {
  //   id: 2,
  //   title: "Lead Programmer",
  //   project: "Weather Visualizer",
  //   company: "TechCorp",
  //   period: "2022-2023",
  //   description:
  //     "Real-time weather visualization dashboard with interactive 3D globe and climate data.",
  //   category: CATEGORY_ID.PROFESSIONAL,
  //   responsibilities: [
  //     "Developed 3D globe visualization using Three.js",
  //     "Integrated with multiple weather APIs",
  //     "Implemented real-time data updates and animations",
  //   ],
  //   technologies: ["Three.js", "React", "D3.js", "WebGL", "REST APIs"],
  //   modelId: "weather_globe",
  //   imageUrl: "/assets/images/weather-visualizer.jpg",
  //   videoLink: "https://example.com/weather-demo",
  //   storeLink: null,
  //   githubLink: "https://github.com/techcorp/weather-visualizer",
  // },
];

const PortfolioSection = () => {
  const [selectedCategory, setSelectedCategory] = createSignal(CATEGORY_ID.ALL);
  const [initialLoading, setInitialLoading] = createSignal(true);
  const [modelStates, setModelStates] = createStore({});
  const { isDark } = createThemeManager();

  // Global model cache to prevent re-creating models
  const modelCache = {};

  const theme = createMemo(() => {
    const dark = isDark();
    return {
      headingText: dark ? "text-blue-100" : "text-blue-900",
      subheadingText: dark ? "text-blue-300" : "text-blue-700",
      bodyText: dark ? "text-gray-300" : "text-gray-600",
      cardBg: dark
        ? "bg-gray-800/50 hover:bg-gray-800"
        : "bg-white hover:bg-blue-50",
      gradient: dark ? "from-gray-900/90" : "from-blue-900/70",
      techBadge: dark
        ? "bg-blue-900/60 text-blue-200"
        : "bg-blue-100/80 text-blue-800",
      linkHover: dark ? "hover:bg-gray-700" : "hover:bg-gray-100",
      divider: dark ? "border-gray-700" : "border-gray-200",
      statsBg: dark ? "bg-blue-900/40" : "bg-blue-50",
      statsText: dark ? "text-blue-300" : "text-blue-600",
      highlightBg: dark ? "bg-gray-800/80" : "bg-white",
      defaultBtn: dark
        ? "bg-blue-900/60 text-blue-200 hover:bg-blue-800"
        : "bg-blue-100/80 text-blue-800 hover:bg-blue-200",
      activeBtn: "bg-blue-600 text-white shadow-md scale-105",
      videoClass: dark ? "text-red-300" : "text-red-500",
      storeClass: dark ? "text-green-300" : "text-green-600",
      githubClass: dark ? "text-gray-300" : "text-gray-600",
      detailsBtn: dark
        ? "text-blue-300 hover:text-blue-200"
        : "text-blue-600 hover:text-blue-800",
      moreBadge: dark
        ? "bg-gray-700 text-gray-300"
        : "bg-gray-100 text-gray-600",
      highlightTitle: dark ? "text-blue-200" : "text-blue-800",
    };
  });

  const visibleExperiences = createMemo(() => {
    const category = selectedCategory();
    return category === CATEGORY_ID.ALL
      ? EXPERIENCES
      : EXPERIENCES.filter((exp) => exp.category === category);
  });

  // Function to handle model initialization
  const handleModelInit = (id, model) => {
    if (!modelCache[id]) {
      modelCache[id] = model;
    }

    setModelStates(id, {
      loaded: true,
      visible: true,
    });

    // Check if all initially visible models are loaded
    checkAllModelsLoaded();
  };

  // Function to update model visibility without destroying it
  const toggleModelVisibility = (id, isVisible) => {
    if (modelCache[id]) {
      // Update visibility state
      setModelStates(id, { visible: isVisible });

      // If using Three.js models, you might also want to pause/resume animations
      if (modelCache[id].scene) {
        // Adjust rendering/animation as needed
        modelCache[id].visible = isVisible;
      }
    }
  };

  // Check if all visible models have been loaded
  const checkAllModelsLoaded = () => {
    const visibleIds = visibleExperiences().map((exp) => exp.modelId);
    const allLoaded = visibleIds.every((id) => modelStates[id]?.loaded);

    if (allLoaded && visibleIds.length > 0) {
      setInitialLoading(false);
    }
  };

  // Get category label with fallback
  const getCategoryLabel = (category) =>
    CATEGORY_LABELS[category] || CATEGORY_LABELS.default;

  // Initialize models and handle category changes
  createEffect(() => {
    const currentCategory = selectedCategory();
    const visible = visibleExperiences();

    // Update visibility of all models based on current category filter
    EXPERIENCES.forEach((exp) => {
      const shouldBeVisible =
        currentCategory === CATEGORY_ID.ALL || exp.category === currentCategory;

      // Only toggle visibility if the model exists in the cache
      if (modelStates[exp.modelId]?.loaded) {
        toggleModelVisibility(exp.modelId, shouldBeVisible);
      }
    });
  });

  // Handle initial loading
  onMount(() => {
    // Initialize the model states for all experiences
    EXPERIENCES.forEach((exp) => {
      setModelStates(exp.modelId, {
        loaded: false,
        visible: false,
      });
    });

    // Fallback timer to ensure we don't stay in loading state forever
    const loadingTimer = setTimeout(() => {
      setInitialLoading(false);
    }, 5000);

    onCleanup(() => clearTimeout(loadingTimer));
  });

  return (
    <div class="space-y-12 py-16 px-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div class="flex items-center justify-between">
        <h2 class={`text-3xl font-bold ${theme().headingText}`}>Portfolio</h2>

        <div class="flex flex-wrap gap-2">
          <For each={CATEGORIES}>
            {(category) => (
              <button
                onClick={() => setSelectedCategory(category.id)}
                class={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  selectedCategory() === category.id
                    ? theme().activeBtn
                    : theme().defaultBtn
                }`}
              >
                {category.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Project Cards Grid */}
      <Show
        when={!initialLoading()}
        fallback={
          <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <For each={EXPERIENCES}>
            {(exp) => (
              <Show
                when={
                  selectedCategory() === CATEGORY_ID.ALL ||
                  exp.category === selectedCategory()
                }
              >
                <ProjectCard
                  id={exp.id}
                  title={exp.title}
                  description={exp.description}
                  modelId={exp.modelId}
                  company={exp.company}
                  period={exp.period}
                  category={exp.category}
                  technologies={exp.technologies}
                  imageUrl={exp.imageUrl}
                  videoLink={exp.videoLink}
                  storeLink={exp.storeLink}
                  githubLink={exp.githubLink}
                  responsibilities={exp.responsibilities}
                  getCategoryLabel={getCategoryLabel}
                  theme={theme()}
                  visible={modelStates[exp.modelId]?.visible}
                  onModelInit={(model) => handleModelInit(exp.modelId, model)}
                  modelCache={modelCache[exp.modelId]}
                />
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default PortfolioSection;
