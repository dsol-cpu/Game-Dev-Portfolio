import {
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
  createEffect,
} from "solid-js";
import { createThemeManager } from "../stores/theme";
import ProjectCard from "./ProjectCard";
import { getModelForProject } from "../stores/projectModelMapping";
import {
  PORTFOLIO_ITEMS,
  CATEGORIES,
  CATEGORY_ID,
  CATEGORY_LABELS,
} from "../constants/portfolio";

const StatCard = (props) => (
  <div class={`rounded-lg shadow-sm p-4 ${props.class}`}>
    <div class="flex flex-col items-center justify-center">
      <div class="text-2xl font-bold mb-1">{props.value}</div>
      <div class="text-xs font-medium">{props.label}</div>
    </div>
  </div>
);

const PortfolioSection = (props) => {
  // Change to array of selected categories
  const [selectedCategories, setSelectedCategories] = createSignal([
    CATEGORY_ID.ALL,
  ]);
  const [expandedItem, setExpandedItem] = createSignal(null);
  const [isInitialized, setIsInitialized] = createSignal(
    props.modelsPreloaded || false
  );
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);
  const { isDark } = createThemeManager();

  // Listen for the modelsPreloaded event
  onMount(() => {
    // If models are already preloaded from App component, set initialized
    if (props.modelsPreloaded) {
      setIsInitialized(true);
    } else {
      // Listen for the preloaded event
      const handleModelsPreloaded = () => {
        console.log("PortfolioSection received modelsPreloaded event");
        setIsInitialized(true);
      };

      window.addEventListener("modelsPreloaded", handleModelsPreloaded);

      // Cleanup event listener
      return () => {
        window.removeEventListener("modelsPreloaded", handleModelsPreloaded);
      };
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      const dropdown = document.getElementById("category-dropdown");
      if (dropdown && !dropdown.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  });

  // React to props changes - if modelsPreloaded becomes true
  createEffect(() => {
    if (props.modelsPreloaded && !isInitialized()) {
      setIsInitialized(true);
    }
  });

  // Force a re-render when initialized changes
  createEffect(() => {
    if (isInitialized()) {
      console.log("3D models initialized and ready to render");
      const cards = document.querySelectorAll(".project-card");
      cards.forEach((card) => {
        void card.offsetHeight;
      });
    }
  });

  const theme = createMemo(() => {
    const dark = isDark();
    return {
      // Base colors
      headingText: dark ? "text-white" : "text-gray-900",
      subheadingText: dark ? "text-gray-300" : "text-gray-600",
      bodyText: dark ? "text-gray-300" : "text-gray-600",

      // Stats cards
      statsBg: dark ? "bg-gray-800" : "bg-white",
      statsText: dark ? "text-gray-300" : "text-gray-600",

      // Accent colors for visual interest
      accentBlue: dark ? "border-blue-500" : "border-blue-500",
      accentGreen: dark ? "border-green-500" : "border-green-500",
      accentPurple: dark ? "border-purple-500" : "border-purple-500",
      accentAmber: dark ? "border-amber-500" : "border-amber-500",

      // Icon backgrounds
      iconBgBlue: dark ? "bg-blue-900/30" : "bg-blue-100",
      iconBgGreen: dark ? "bg-green-900/30" : "bg-green-100",
      iconBgPurple: dark ? "bg-purple-900/30" : "bg-purple-100",
      iconBgAmber: dark ? "bg-amber-900/30" : "bg-amber-100",

      // Buttons
      defaultBtn: dark
        ? "bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
        : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50",
      activeBtn: dark
        ? "bg-blue-600 text-white border border-blue-700"
        : "bg-blue-600 text-white border border-blue-700",

      // Dropdown
      dropdownBg: dark ? "bg-gray-800" : "bg-white",
      dropdownBorder: dark ? "border-gray-700" : "border-gray-200",
      dropdownHover: dark ? "hover:bg-gray-700" : "hover:bg-gray-100",
      dropdownShadow: "shadow-lg",

      // Call to action
      ctaBg: dark
        ? "bg-gray-800 border-l-4 border-blue-500"
        : "bg-white border-l-4 border-blue-500",

      // Container styles
      sectionBg: dark ? "bg-gray-900" : "bg-gray-50",
      cardWrapper: dark
        ? "bg-gray-800/50 p-1 rounded-lg hover:shadow-md transition-all duration-300"
        : "bg-white/50 p-1 rounded-lg hover:shadow-md transition-all duration-300",

      // Portfolio Header
      headerBg: dark ? "bg-gray-800" : "bg-white",
      headerBorder: dark ? "border-gray-700" : "border-gray-200",

      // Multi-select styles
      tagPill: dark
        ? "bg-blue-900/50 text-blue-300 border border-blue-800"
        : "bg-blue-100 text-blue-800 border border-blue-200",
      tagPillSelected: dark
        ? "bg-blue-700 text-white border border-blue-600"
        : "bg-blue-600 text-white border border-blue-700",
      badge: dark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
    };
  });

  // Filter items based on selected categories
  const filteredItems = createMemo(() => {
    const categories = selectedCategories();

    // If "All" is selected, show everything
    if (categories.includes(CATEGORY_ID.ALL)) {
      return PORTFOLIO_ITEMS;
    }

    // Filter projects that match any of the selected categories
    return PORTFOLIO_ITEMS.filter((item) => {
      // Check primary category
      if (categories.includes(item.category)) {
        return true;
      }

      // Check subcategories (if they exist)
      if (
        item.subcategories &&
        item.subcategories.some((subcat) => categories.includes(subcat))
      ) {
        return true;
      }

      // Check categories array (new multi-category support)
      if (
        item.categories &&
        item.categories.some((cat) => categories.includes(cat))
      ) {
        return true;
      }

      return false;
    });
  });

  // Toggle item details expanded state
  const toggleItem = (id) =>
    setExpandedItem((prev) => (prev === id ? null : id));

  // Get category label with fallback
  const getCategoryLabel = (category) =>
    CATEGORY_LABELS[category] || CATEGORY_LABELS.default;

  // Toggle dropdown
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen());

  // Get categories for a project (combining primary category and subcategories)
  const getProjectCategories = (project) => {
    const categories = [project.category];

    // Add subcategories if they exist
    if (project.subcategories && project.subcategories.length) {
      categories.push(...project.subcategories);
    }

    // Add categories array if it exists (new multi-category support)
    if (project.categories && project.categories.length) {
      project.categories.forEach((cat) => {
        if (!categories.includes(cat)) {
          categories.push(cat);
        }
      });
    }

    return categories;
  };

  // New function to handle category selection
  const toggleCategory = (categoryId) => {
    setSelectedCategories((prev) => {
      // Handle "All" category as a special case
      if (categoryId === CATEGORY_ID.ALL) {
        return [CATEGORY_ID.ALL];
      }

      // Remove "All" when selecting a specific category
      let newCategories = prev.filter((id) => id !== CATEGORY_ID.ALL);

      // Toggle the selected category
      if (newCategories.includes(categoryId)) {
        newCategories = newCategories.filter((id) => id !== categoryId);
        // If no categories left, select "All"
        if (newCategories.length === 0) {
          return [CATEGORY_ID.ALL];
        }
      } else {
        newCategories.push(categoryId);
      }

      return newCategories;
    });
  };

  // Check if a category is currently selected
  const isCategorySelected = (categoryId) => {
    return selectedCategories().includes(categoryId);
  };

  // Create a memo for selected category count
  const selectedCategoryCount = createMemo(() => {
    const cats = selectedCategories();
    return cats.includes(CATEGORY_ID.ALL) ? 1 : cats.length;
  });

  return (
    <div class={`py-10 ${theme().sectionBg}`}>
      {/* Portfolio Header with Category Selection */}
      <div class={`container mx-auto px-4 mb-8`}>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div class="flex-1">
            <h2 class={`text-2xl font-bold mb-2 ${theme().headingText}`}>
              My Projects
            </h2>
            <p class={`${theme().subheadingText}`}>
              Browse through my portfolio of {PORTFOLIO_ITEMS.length} projects
              across various categories
            </p>
          </div>

          {/* Category Filter with Multi-select */}
          <div class="relative" id="category-dropdown">
            <div class={`text-sm mb-1 font-medium ${theme().bodyText}`}>
              Filter by Categories ({selectedCategoryCount()})
            </div>
            <div
              onClick={toggleDropdown}
              class={`cursor-pointer flex items-center justify-between px-4 py-2 rounded-md ${
                theme().defaultBtn
              } min-w-[200px]`}
            >
              <span class="text-xs opacity-70">
                {selectedCategoryCount()}{" "}
                {selectedCategoryCount() === 1 ? "Category" : "Categories"}{" "}
                Selected
              </span>
              <div class="flex items-center">
                <span>All Categories</span>
              </div>
              <div></div>
            </div>

            <Show when={isDropdownOpen()}>
              <div
                class={`absolute z-50 mt-1 w-full rounded-md ${theme().dropdownBg} ${
                  theme().dropdownBorder
                } border ${theme().dropdownShadow} max-h-64 overflow-auto`}
              >
                <For each={CATEGORIES}>
                  {(category) => (
                    <button
                      onClick={() => toggleCategory(category.id)}
                      class={`w-full px-4 py-3 text-left text-sm flex items-center gap-2
                              ${
                                isCategorySelected(category.id)
                                  ? `${theme().activeBtn} font-medium`
                                  : `${theme().dropdownHover} ${theme().bodyText}`
                              }
                            `}
                    >
                      {category.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Selected category pills - visible when not showing all */}
        <Show when={!selectedCategories().includes(CATEGORY_ID.ALL)}>
          <div class="flex flex-wrap gap-2 mb-4">
            <For each={selectedCategories()}>
              {(categoryId) => {
                const category = CATEGORIES.find((c) => c.id === categoryId);
                return (
                  <button
                    class={`${theme().tagPillSelected} px-2 py-1 text-xs rounded-full flex items-center gap-1`}
                    onClick={() => toggleCategory(categoryId)}
                  >
                    {category?.label ||
                      CATEGORY_LABELS[categoryId] ||
                      "Category"}
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Project Count Summary */}
      <div class="container mx-auto px-4 mb-4">
        <p
          class={`text-xs ${theme().bodyText} border-b ${
            isDark() ? "border-gray-800" : "border-gray-200"
          } pb-2`}
        >
          Showing {filteredItems().length} of {PORTFOLIO_ITEMS.length} projects
        </p>
      </div>

      {/* Project Grid with subtle card wrappers */}
      <div class="container mx-auto px-4 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        <For each={filteredItems()}>
          {(item) => {
            const projectCategories = getProjectCategories(item);
            return (
              <div class={`project-card ${theme().cardWrapper}`}>
                <ProjectCard
                  project={item}
                  isExpanded={expandedItem() === item.id}
                  onToggleDetails={() => toggleItem(item.id)}
                  projectCategories={projectCategories}
                  getCategoryLabel={getCategoryLabel}
                  forceRender={isInitialized()}
                  getModelForProject={getModelForProject}
                  accentColor={item.modelConfig?.color || 0x3b82f6}
                />
              </div>
            );
          }}
        </For>
      </div>

      {/* Empty State - More visually interesting */}
      <Show when={filteredItems().length === 0}>
        <div
          class={`container mx-auto px-4 py-12 ${
            theme().cardWrapper
          } text-center max-w-md mx-auto`}
        >
          <div
            class={`w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-full ${
              theme().iconBgBlue
            }`}
          ></div>
          <h3 class={`text-xl font-bold mb-2 ${theme().headingText}`}>
            No projects found
          </h3>
          <p class={`mb-6 ${theme().subheadingText}`}>
            No projects found with the selected categories. Try different
            categories or show all projects.
          </p>
          <button
            onClick={() => setSelectedCategories([CATEGORY_ID.ALL])}
            class={`mt-5 px-4 py-2 rounded-md ${theme().activeBtn}`}
          >
            Show All Projects
          </button>
        </div>
      </Show>

      {/* Simplified CTA with visual accent */}
      <div
        class={`container mx-auto px-4 mt-8 p-6 rounded-lg ${theme().ctaBg}`}
      >
        <div class="md:flex md:justify-between md:items-center">
          <div class="mb-4 md:mb-0">
            <h3 class={`text-xl font-bold mb-2 ${theme().headingText}`}>
              Looking for a Game Developer?
            </h3>
            <p class={`${theme().bodyText}`}>
              I'm currently available for new projects. Let's create immersive
              gaming experiences together!
            </p>
          </div>
          <div class="flex gap-3">
            <button class={`px-5 py-2 rounded-md ${theme().activeBtn}`}>
              Contact Me
            </button>
            <button class={`px-5 py-2 rounded-md ${theme().defaultBtn}`}>
              Resume
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSection;
