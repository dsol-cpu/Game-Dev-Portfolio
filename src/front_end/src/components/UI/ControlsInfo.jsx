import { createSignal, Show, onMount, createEffect } from "solid-js";

const ControlsInfo = () => {
  const [isMobile, setIsMobile] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(true);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isHovering, setIsHovering] = createSignal(false);

  // Create a derived signal for panel opacity
  const [panelOpacity, setPanelOpacity] = createSignal("0.4");

  // Update opacity when hover state changes
  createEffect(() => {
    setPanelOpacity(isHovering() ? "1" : "0.4");
  });

  // Check if device is mobile
  onMount(() => {
    const checkMobile = () => {
      const mobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Global keyboard shortcut for toggling collapsed state
    const handleKeyDown = (e) => {
      if (e.key === "h" || e.key === "H") {
        setIsCollapsed(!isCollapsed());
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  // Helper to render control items
  const ControlItem = (props) => (
    <div class="flex items-center mb-2 text-sm">
      <div
        class="flex items-center justify-center bg-blue-600 rounded-lg p-1 mr-2 w-8 h-8"
        aria-hidden="true"
      >
        {props.icon}
      </div>
      <span>{props.text}</span>
    </div>
  );

  // Event handlers for mouse events
  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  // Toggle collapsed state
  const toggleCollapsed = () => setIsCollapsed(!isCollapsed());

  // Handle keyboard interactions for the toggle button
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCollapsed();
    }
  };

  return (
    <Show when={isVisible()}>
      <div
        role="region"
        tabIndex="0"
        aria-label="Information panel"
        class="absolute left-4 top-4 transform text-white p-3 rounded-lg z-10 animate-fadeIn"
        style={{
          "background-color": "rgba(0, 0, 0, 0.65)",
          "backdrop-filter": "blur(10px)",
          "-webkit-backdrop-filter": "blur(10px)",
          "box-shadow":
            "0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          opacity: panelOpacity(),
          transition: "opacity 0.3s ease-in-out, width 0.3s ease-in-out",
          width: isCollapsed() ? "auto" : "16rem", // 16rem = w-64
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            // If you want any keyboard action when the element is focused
            // For example, to toggle the collapsed state
          }
        }}
      >
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold">Game Controls</h3>
          <button
            onClick={toggleCollapsed}
            onKeyDown={handleKeyDown}
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
                d={
                  isCollapsed()
                    ? "M4 8a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" // Expand icon
                    : "M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" // Collapse icon
                }
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <Show when={!isCollapsed()}>
          <Show
            when={isMobile()}
            fallback={
              <div>
                <ControlItem
                  icon={
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
                        clip-rule="evenodd"
                      />
                      <path
                        fill-rule="evenodd"
                        d="M12 5a1 1 0 011 1v8a1 1 0 11-2 0V6a1 1 0 011-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  }
                  text="WASD/Arrow Keys - Move ship and turn"
                />
                <ControlItem
                  icon={
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 5a1 1 0 011 1v8a1 1 0 11-2 0V6a1 1 0 011-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  }
                  text="Space - Increase altitude"
                />
                <ControlItem
                  icon={
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  }
                  text="Shift - Decrease altitude"
                />
              </div>
            }
          >
            <div>
              <ControlItem
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16z"
                      clip-rule="evenodd"
                    />
                  </svg>
                }
                text="Left Joystick - Move ship and turn"
              />
              <ControlItem
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="blue"
                    viewBox="0 0 20 20"
                  >
                    <circle cx="10" cy="10" r="8" />
                  </svg>
                }
                text="Blue Button - Increase altitude"
              />
              <ControlItem
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="red"
                    viewBox="0 0 20 20"
                  >
                    <circle cx="10" cy="10" r="8" />
                  </svg>
                }
                text="Red Button - Decrease altitude"
              />
            </div>
          </Show>
        </Show>

        {/* Always visible hotkey hint regardless of collapsed state */}
        <div class="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-400">
          Press H to {isCollapsed() ? "expand" : "collapse"} controls
        </div>
      </div>
    </Show>
  );
};

export default ControlsInfo;
