import { createSignal, onMount, onCleanup } from "solid-js";
import { Icon } from "./icons/Icon";

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  // Check fullscreen state
  const checkFullscreen = () => setIsFullscreen(!!document.fullscreenElement);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  onMount(() => {
    // Add fullscreen event listener
    document.addEventListener("fullscreenchange", checkFullscreen);
    checkFullscreen();

    // Clean up
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
    });
  });

  return (
    <button
      onClick={toggleFullscreen}
      class="absolute top-4 right-4 px-4 py-2 font-bold text-amber-100 transition-transform duration-300 border-2 border-yellow-600 rounded shadow-lg hover:scale-105 bg-gradient-to-b from-blue-800 to-blue-950"
    >
      <div class="flex items-center justify-center space-x-2">
        {isFullscreen() ? (
          <Icon name="unfullscreen" class="text-yellow-400" />
        ) : (
          <Icon name="fullscreen" class="text-yellow-400" />
        )}
        <span>{isFullscreen() ? "Exit Fullscreen" : "Fullscreen"}</span>
      </div>
    </button>
  );
}
