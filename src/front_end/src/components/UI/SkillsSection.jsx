import { createSignal } from "solid-js";

const SkillsSection = () => {
  const [selectedCategory, setSelectedCategory] = createSignal("all");

  const skillCategories = [
    { id: "all", label: "All Skills" },
    { id: "programming", label: "Programming" },
    { id: "game-engines", label: "Game Engines" },
    { id: "graphics", label: "Graphics & 3D" },
    { id: "design", label: "Game Design" },
  ];

  const skills = [
    { name: "JavaScript", level: 90, category: "programming" },
    { name: "TypeScript", level: 85, category: "programming" },
    { name: "C#", level: 80, category: "programming" },
    { name: "C++", level: 70, category: "programming" },
    { name: "Python", level: 75, category: "programming" },
    { name: "Unity", level: 95, category: "game-engines" },
    { name: "Unreal Engine", level: 80, category: "game-engines" },
    { name: "Godot", level: 70, category: "game-engines" },
    { name: "WebGL", level: 75, category: "graphics" },
    { name: "Three.js", level: 85, category: "graphics" },
    { name: "Blender", level: 80, category: "graphics" },
    { name: "Shader Programming", level: 70, category: "graphics" },
    { name: "Game Mechanics", level: 90, category: "design" },
    { name: "Level Design", level: 85, category: "design" },
    { name: "Storytelling", level: 80, category: "design" },
    { name: "User Experience", level: 85, category: "design" },
  ];

  const filteredSkills = () => {
    return selectedCategory() === "all"
      ? skills
      : skills.filter((skill) => skill.category === selectedCategory());
  };

  return (
    <div class="space-y-6">
      {/* Category Filter */}
      <div class="flex flex-wrap gap-2">
        {skillCategories.map((category) => (
          <button
            onClick={() => setSelectedCategory(category.id)}
            class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedCategory() === category.id
                ? "bg-blue-600 text-white"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSkills().map((skill) => (
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-blue-900">{skill.name}</span>
              <span class="text-sm text-blue-700">{skill.level}%</span>
            </div>
            <div class="w-full bg-blue-200 rounded-full h-2.5">
              <div
                class="bg-blue-600 h-2.5 rounded-full"
                style={`width: ${skill.level}%`}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Experience Summary */}
      <div class="mt-8 bg-blue-50 p-5 rounded-lg border border-blue-100">
        <h3 class="text-xl font-bold text-blue-900 mb-3">
          Experience Highlights
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start">
            <svg
              class="w-5 h-5 text-green-500 mr-2 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <span>5+ years of professional game development experience</span>
          </li>
          <li class="flex items-start">
            <svg
              class="w-5 h-5 text-green-500 mr-2 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <span>Shipped 3 commercial games with over 100,000 downloads</span>
          </li>
          <li class="flex items-start">
            <svg
              class="w-5 h-5 text-green-500 mr-2 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <span>Winner of "Best Indie Game" at GameDev Expo 2023</span>
          </li>
          <li class="flex items-start">
            <svg
              class="w-5 h-5 text-green-500 mr-2 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <span>Contributed to open-source game development tools</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SkillsSection;
