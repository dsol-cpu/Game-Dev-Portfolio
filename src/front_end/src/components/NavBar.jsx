import { createSignal, createEffect, createMemo, onCleanup } from "solid-js";
import { createThemeManager } from "../stores/theme";
import { deviceStore } from "../stores/device";
import ThemeToggle from "./ThemeToggle";
import Icon from "./icons/Icon";

// Helper function for conditional classes
const cx = (...classes) => classes.filter(Boolean).join(" ");

// Navigation data extracted to avoid repetition
const NAVIGATION_SECTIONS = [
  { id: "about", label: "About" },
  { id: "portfolio", label: "Portfolio" },
  { id: "resume", label: "Resume" },
];

export default function NavBar() {
  const { isDark } = createThemeManager();
  const { isMobile } = deviceStore;
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeSection, setActiveSection] = createSignal("about");
  const [pressedArrow, setPressedArrow] = createSignal(null); // Add state for pressed arrow

  // Register cleanup at component level using onCleanup
  onCleanup(() => deviceStore.registerCleanup());

  // Memoized values for theme-dependent styles
  const themeClasses = createMemo(() => ({
    navbar: isDark()
      ? "bg-slate-900 text-green-300 border-cyan-700 bg-gradient-to-b from-slate-900 to-blue-900/40"
      : "bg-slate-100 text-slate-800 border-emerald-400 bg-gradient-to-b from-slate-100 to-teal-200/50",
    navButton: isDark()
      ? "text-cyan-300 hover:bg-cyan-800 hover:text-white"
      : "text-emerald-600 hover:bg-emerald-200 hover:text-slate-900",
    pressedButton: isDark()
      ? "bg-cyan-700 text-white transform scale-95"
      : "bg-emerald-300 text-slate-900 transform scale-95",
    activeLink: isDark()
      ? "bg-cyan-700 text-white"
      : "bg-emerald-400 text-slate-900",
    inactiveLink: isDark()
      ? "text-gray-300 hover:bg-cyan-800 hover:text-white"
      : "text-gray-700 hover:bg-emerald-300 hover:text-slate-900",
  }));

  // Navigate to section with optimized event handling
  const navigateToSection = (sectionId, event) => {
    if (event) event.preventDefault();

    // Skip if already at destination
    if (activeSection() === sectionId) return;

    setActiveSection(sectionId);

    window.dispatchEvent(
      new CustomEvent("portfolioSectionChange", {
        detail: { section: sectionId },
      })
    );

    // Close mobile menu after navigation on mobile
    if (isMobile()) setIsOpen(false);
  };

  // Navigate direction with simplified logic
  const navigateDirection = (direction) => {
    const sections = NAVIGATION_SECTIONS.map((s) => s.id);
    const currentIndex = sections.indexOf(activeSection());
    const offset = direction === "next" ? 1 : -1;
    const newIndex =
      (currentIndex + offset + sections.length) % sections.length;

    navigateToSection(sections[newIndex]);
  };

  // Key event handler for keyboard navigation with visual feedback
  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      setPressedArrow("left");
      navigateDirection("prev");
    } else if (event.key === "ArrowRight") {
      setPressedArrow("right");
      navigateDirection("next");
    }
  };

  // Reset pressed arrow state on key up
  const handleKeyUp = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      setPressedArrow(null);
    }
  };

  // Setup and cleanup keyboard event listeners
  createEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    });
  });

  // Memoized navigation link component for reuse
  const NavLink = (props) => {
    const isActive = () => activeSection() === props.section.id;

    return (
      <a
        href={`#${props.section.id}`}
        class={cx(
          props.isMobile
            ? "block"
            : "px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive() ? themeClasses().activeLink : themeClasses().inactiveLink
        )}
        onClick={(e) => navigateToSection(props.section.id, e)}
        aria-current={isActive() ? "page" : undefined}
      >
        {props.section.label}
      </a>
    );
  };

  return (
    <nav
      class={cx(
        "fixed top-0 left-0 z-30 w-full border-b shadow-lg",
        themeClasses().navbar
      )}
      aria-label="Main navigation"
    >
      <div class="mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <span class="text-xl font-bold">David Solinsky</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div class="flex items-center space-x-4">
            <button
              onClick={() => navigateDirection("prev")}
              class={cx(
                "p-2 rounded-full transition-colors transition-transform duration-150",
                pressedArrow() === "left"
                  ? themeClasses().pressedButton
                  : themeClasses().navButton
              )}
              aria-label="Previous section"
            >
              <Icon name="left-arrow" />
            </button>

            <button
              onClick={() => navigateDirection("next")}
              class={cx(
                "p-2 rounded-full transition-colors transition-transform duration-150",
                pressedArrow() === "right"
                  ? themeClasses().pressedButton
                  : themeClasses().navButton
              )}
              aria-label="Next section"
            >
              <Icon name="right-arrow" />
            </button>
          </div>

          {/* Desktop menu */}
          <div class="hidden md:block">
            <div class="ml-10 flex items-center space-x-4">
              {NAVIGATION_SECTIONS.map((section) => (
                <NavLink section={section} isMobile={false} />
              ))}
            </div>
          </div>

          {/* Theme toggle and mobile menu button */}
          <div class="flex items-center space-x-4">
            <ThemeToggle />

            {/* Mobile menu button */}
            <div class="md:hidden">
              <button
                onClick={() => setIsOpen((prev) => !prev)}
                class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                aria-expanded={isOpen()}
                aria-controls="mobile-menu"
                aria-label="Toggle mobile menu"
              >
                <span class="sr-only">
                  {isOpen() ? "Close main menu" : "Open main menu"}
                </span>
                <svg
                  class={isOpen() ? "hidden" : "block h-6 w-6"}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                <svg
                  class={isOpen() ? "block h-6 w-6" : "hidden"}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div id="mobile-menu" class={isOpen() ? "block md:hidden" : "hidden"}>
          <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {NAVIGATION_SECTIONS.map((section) => (
              <NavLink section={section} isMobile={true} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
