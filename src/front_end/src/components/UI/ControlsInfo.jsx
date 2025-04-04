import { createSignal, Show, onMount } from "solid-js";

const ControlsInfo = () => {
  const [showInfo, setShowInfo] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);

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

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  return (
    <div class="fixed top-4 right-4 z-50">
      <button
        class="bg-black bg-opacity-50 text-white rounded-full p-2 flex items-center justify-center"
        onClick={() => setShowInfo(!showInfo())}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      <Show when={showInfo()}>
        <div class="absolute top-full right-0 mt-2 p-4 bg-black bg-opacity-70 text-white rounded-lg w-64 shadow-lg">
          <h3 class="text-xl font-bold mb-2">Controls</h3>

          <Show
            when={isMobile()}
            fallback={
              <div>
                <p class="mb-2">
                  <span class="font-bold">Arrow Keys</span> - Move ship
                  forward/backward and turn
                </p>
                <p class="mb-2">
                  <span class="font-bold">Space</span> - Increase altitude
                </p>
                <p class="mb-2">
                  <span class="font-bold">Ctrl</span> - Decrease altitude
                </p>
                <p class="mb-2">
                  <span class="font-bold">Spacebar (double tap)</span> - Reset
                  orientation
                </p>
              </div>
            }
          >
            <div>
              <p class="mb-2">
                <span class="font-bold">Left Joystick</span> - Move ship and
                turn
              </p>
              <p class="mb-2">
                <span class="font-bold">Blue Button</span> - Increase altitude
              </p>
              <p class="mb-2">
                <span class="font-bold">Red Button</span> - Decrease altitude
              </p>
              <p class="mb-2">
                <span class="font-bold">Double tap joystick</span> - Reset
                orientation
              </p>
            </div>
          </Show>

          <button
            class="mt-3 px-4 py-1 bg-blue-600 text-white rounded"
            onClick={() => setShowInfo(false)}
          >
            Close
          </button>
        </div>
      </Show>
    </div>
  );
};

export default ControlsInfo;
