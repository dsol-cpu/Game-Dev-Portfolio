import { createSignal, createMemo, For, Show } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import Icon from "../icons/Icon";

const CATEGORIES = [
  { id: "all", label: "All Projects" },
  { id: "shipped", label: "Shipped Games" },
  { id: "professional", label: "Professional Work" },
];

const EXPERIENCES = [
  {
    id: 1,
    title: "Gameplay Programmer",
    project: "Quick Quisine",
    company: "",
    period: "2021",
    description: "WarioWare-like Cooking game.",
    category: "shipped",
    responsibilities: ["Made the art", "Made DDR-like minigame"],
    technologies: ["SFML", "C++", "Git", "CMake"],
  },
];

const CATEGORY_LABELS = {
  shipped: "Shipped Game",
  professional: "Professional Work",
  default: "Personal Project",
};

const STATS = [
  { value: "4", label: "Shipped Games" },
  { value: "1.2M+", label: "Total Downloads" },
  { value: "6+", label: "Years Experience" },
  { value: "8", label: "Team Projects" },
];

const TechBadge = (props) => (
  <span class={`px-2 py-1 rounded-full text-xs ${props.classes}`}>
    {props.tech}
  </span>
);

const ProjectCardHeader = (props) => (
  <div class="relative h-48 overflow-hidden">
    <img
      src={props.imageUrl || "assets/favicon.ico"}
      alt={props.title}
      class="w-full h-full object-cover"
    />
    <div
      class={`absolute inset-0 bg-gradient-to-t ${props.gradientClass} to-transparent`}
    ></div>
    <div class="absolute bottom-0 left-0 p-4 w-full">
      <span class="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-600/90 text-white mb-2">
        {props.categoryLabel}
      </span>
      <h3 class="text-xl font-bold text-white">{props.title}</h3>
      <p class="text-sm text-gray-200">
        {props.company && `${props.company} • `}
        {props.period}
      </p>
    </div>
  </div>
);

const SocialLinks = (props) => (
  <div class="flex gap-2">
    <Show when={props.videoLink}>
      <a
        href={props.videoLink}
        target="_blank"
        rel="noopener noreferrer"
        class={`p-2 rounded-full ${props.videoClass} ${props.hoverClass}`}
        title="Demo Video"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path>
        </svg>
      </a>
    </Show>
    <Show when={props.storeLink}>
      <a
        href={props.storeLink}
        target="_blank"
        rel="noopener noreferrer"
        class={`p-2 rounded-full ${props.storeClass} ${props.hoverClass}`}
        title="Store Page"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.06 13a8 8 0 0 0 5.18 6.51A18.5 18.5 0 0 1 8.02 13zm15.88 0a18.5 18.5 0 0 1-1.22 6.51A8 8 0 0 0 19.94 13zm-4.12 0a18.5 18.5 0 0 1-3.82 6.51A8 8 0 0 0 12 20a8 8 0 0 0 .18-7zm-8.12 0a18.5 18.5 0 0 1 3.82 6.51A8 8 0 0 0 12 20a8 8 0 0 0-.18-7zm4.3-11C16.84 2 20 5.16 20 9.29V10h-2v-.71C18 6.37 15.63 4 12.8 4H8a2 2 0 0 0-2 2v4h2V6h4.8c.46 0 .9.1 1.3.29A5.91 5.91 0 0 0 12 13v7h2v-7a5.91 5.91 0 0 0-2.1-4.71c-.4-.19-.84-.29-1.3-.29H8v10.93A8.03 8.03 0 0 1 4.07 10H4v-.71C4 5.16 7.16 2 11.1 2z"></path>
        </svg>
      </a>
    </Show>
    <Show when={props.githubLink}>
      <a
        href={props.githubLink}
        target="_blank"
        rel="noopener noreferrer"
        class={`p-2 rounded-full ${props.githubClass} ${props.hoverClass}`}
        title="GitHub"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
        </svg>
      </a>
    </Show>
  </div>
);

const StatCard = (props) => (
  <div class={`rounded-lg p-6 text-center ${props.bgClass}`}>
    <div class={`text-4xl font-bold mb-2 ${props.valueClass}`}>
      {props.value}
    </div>
    <p class={`text-sm ${props.textClass}`}>{props.label}</p>
  </div>
);

const ExperienceSection = () => {
  const [selectedCategory, setSelectedCategory] = createSignal("all");
  const [expandedProject, setExpandedProject] = createSignal(null);
  const { isDark } = createThemeManager();

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

  const filteredExperiences = createMemo(() =>
    selectedCategory() === "all"
      ? EXPERIENCES
      : EXPERIENCES.filter((exp) => exp.category === selectedCategory())
  );

  // Toggle project details expanded state
  const toggleProject = (id) =>
    setExpandedProject((prev) => (prev === id ? null : id));

  // Get category label with fallback
  const getCategoryLabel = (category) =>
    CATEGORY_LABELS[category] || CATEGORY_LABELS.default;

  return (
    <div class="space-y-12">
      {/* Header Section */}
      <div class="flex items-center justify-between">
        <h2 class={`text-3xl font-bold ${theme().headingText}`}>Experience</h2>

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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <For each={filteredExperiences()}>
          {(exp) => (
            <div
              class={`rounded-xl overflow-hidden transition-all duration-300 ${
                theme().cardBg
              } shadow-lg hover:shadow-xl transform hover:-translate-y-1`}
            >
              <ProjectCardHeader
                imageUrl={exp.imageUrl}
                title={exp.project}
                company={exp.company}
                period={exp.period}
                categoryLabel={getCategoryLabel(exp.category)}
                gradientClass={theme().gradient}
              />

              <div class="p-5">
                <h4 class={`font-medium mb-3 ${theme().subheadingText}`}>
                  {exp.title}
                </h4>

                <p class={`text-sm mb-4 ${theme().bodyText}`}>
                  {exp.description}
                </p>

                <div class="flex flex-wrap gap-2 mb-4">
                  <For each={exp.technologies.slice(0, 3)}>
                    {(tech) => (
                      <TechBadge tech={tech} classes={theme().techBadge} />
                    )}
                  </For>
                  <Show when={exp.technologies.length > 3}>
                    <span
                      class={`px-3 py-1 rounded-full text-xs font-medium ${theme().moreBadge}`}
                    >
                      +{exp.technologies.length - 3} more
                    </span>
                  </Show>
                </div>

                <div class="flex items-center justify-between pt-2">
                  <button
                    onClick={() => toggleProject(exp.id)}
                    className={`text-sm font-medium ${theme().detailsBtn} flex items-center gap-1`}
                  >
                    {expandedProject() === exp.id
                      ? "Hide details"
                      : "View details"}
                    <Icon
                      name="chevron-down"
                      className={`ml-1 transition-transform ${expandedProject() === exp.id ? "scale-y-[-1]" : ""}`}
                    />
                  </button>

                  <SocialLinks
                    videoLink={exp.videoLink}
                    storeLink={exp.storeLink}
                    githubLink={exp.githubLink}
                    videoClass={theme().videoClass}
                    storeClass={theme().storeClass}
                    githubClass={theme().githubClass}
                    hoverClass={theme().linkHover}
                  />
                </div>

                <Show when={expandedProject() === exp.id}>
                  <div class={`mt-4 pt-4 border-t ${theme().divider}`}>
                    <h5
                      class={`text-sm font-medium mb-2 ${theme().subheadingText}`}
                    >
                      Key Contributions:
                    </h5>
                    <ul
                      class={`list-disc pl-5 mb-4 text-sm ${theme().bodyText}`}
                    >
                      <For each={exp.responsibilities}>
                        {(item) => <li class="mb-1">{item}</li>}
                      </For>
                    </ul>

                    <h5
                      class={`text-sm font-medium mb-2 ${theme().subheadingText}`}
                    >
                      All Technologies:
                    </h5>
                    <div class="flex flex-wrap gap-2">
                      <For each={exp.technologies}>
                        {(tech) => (
                          <TechBadge tech={tech} classes={theme().techBadge} />
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Career Highlights Stats */}
      <div class={`${theme().highlightBg} rounded-xl p-8 shadow-lg`}>
        <h3 class={`text-xl font-bold ${theme().highlightTitle} mb-6`}>
          Career Highlights
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <For each={STATS}>
            {(stat) => (
              <StatCard
                value={stat.value}
                label={stat.label}
                bgClass={theme().statsBg}
                valueClass={theme().statsText}
                textClass={theme().bodyText}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export default ExperienceSection;
