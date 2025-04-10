import {
  createSignal,
  Show,
  onMount,
  createEffect,
  createMemo,
} from "solid-js";
import { Icon } from "../icons/Icon";

const ControlsInfo = () => {
  const [isMobile, setIsMobile] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(true);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isHovering, setIsHovering] = createSignal(false);

  const panelOpacity = createMemo(() => (isHovering() ? "1" : "0.4"));

  const panelStyle = createMemo(() => ({
    "background-color": "rgba(0, 0, 0, 0.65)",
    "backdrop-filter": "blur(10px)",
    "-webkit-backdrop-filter": "blur(10px)",
    "box-shadow": "0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    opacity: panelOpacity(),
    transition: "opacity 0.3s ease-in-out, width 0.3s ease-in-out",
    width: isCollapsed() ? "auto" : "16rem",
  }));

  const toggleButtonPath = createMemo(() =>
    isCollapsed()
      ? "M4 8a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z"
      : "M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
  );

  // Check if device is mobile only once on mount and on resize
  onMount(() => {
    // Debounced check for mobile devices
    let resizeTimer;

    const checkMobile = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setIsMobile(
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          )
        );
      }, 100);
    };

    // Event handler for keyboard shortcuts with appropriate passive option
    const handleKeyDown = (e) => {
      if (e.key === "h" || e.key === "H") {
        setIsCollapsed((prev) => !prev);
      }
    };

    // Initial check
    checkMobile();

    // Add event listeners with passive option for better performance
    window.addEventListener("resize", checkMobile, { passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  const handleKeyboardToggle = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCollapsed();
    }
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  // Helper to render control items - moved outside component to avoid recreation
  const ControlItem = (props) => (
    <div class="flex items-center mb-2 text-sm select-none">
      <div class="mr-2 flex-shrink-0 w-6 h-6 flex items-center justify-center select-none">
        {props.icon}
      </div>
      <span class="select-none">{props.text}</span>
    </div>
  );

  const MobileControls = () => (
    <div class="select-none">
      <ControlItem
        icon={
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="8" />
          </svg>
        }
        text="[ Left Joystick ] - Move"
      />
      <ControlItem icon={<Icon name="up_button" />} text="[ Up ] - Ascend" />
      <ControlItem
        icon={<Icon name="down_button" />}
        text="[ Down ] - Descend"
      />
    </div>
  );

  const DesktopControls = () => (
    <div class="select-none">
      <ControlItem
        icon={<Icon name="wasd" />}
        text="[ WASD/Arrow Keys ] - Move"
      />
      <ControlItem icon={<Icon name="space" />} text="[ Space ] - Ascend" />
      <ControlItem icon={<Icon name="shift" />} text="[ Shift ] - Descend" />
    </div>
  );

  return (
    <Show when={isVisible()}>
      <div
        role="region"
        tabIndex="0"
        aria-label="Information panel"
        class="absolute left-4 top-4 transform text-white p-3 rounded-lg z-10 animate-fadeIn"
        style={panelStyle()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold select-none">Game Controls</h3>
          <button
            onClick={toggleCollapsed}
            onKeyDown={handleKeyboardToggle}
            class="text-gray-300 hover:text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={isCollapsed() ? "Expand controls" : "Collapse controls"}
            aria-expanded={!isCollapsed()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d={toggleButtonPath()}
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <Show when={!isCollapsed()}>
          <Show when={isMobile()} fallback={<DesktopControls />}>
            <MobileControls />
          </Show>
        </Show>

        <Show when={!isMobile()} class="border-gray-600 text-gray-400">
          <div class=" select-none text-xs mt-2 text-gray-400">
            Press H to {isCollapsed() ? "expand" : "collapse"} controls
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default ControlsInfo;
