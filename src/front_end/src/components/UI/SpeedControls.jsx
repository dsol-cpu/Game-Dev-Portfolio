import { createSignal } from "solid-js";
import { navigationStore } from "../../stores/navigationStore";

export default function SpeedControls() {
  const { shipSpeed, setShipSpeed } = navigationStore;
  const [showSpeedControls, setShowSpeedControls] = createSignal(false);

  // Toggle speed controls
  const toggleSpeedControls = () => {
    setShowSpeedControls(!showSpeedControls());
  };

  // Handle speed change
  const handleSpeedChange = (e) => {
    setShipSpeed(parseFloat(e.target.value));
  };

  // Get formatted speed text
  const getSpeedText = () => {
    return `${shipSpeed().toFixed(1)}x`;
  };

  return (
    <div class="absolute bottom-4 right-4 bg-black/30 backdrop-blur-sm rounded-lg border border-cyan-500/30 shadow-lg text-white z-10 w-64">
      <button
        onClick={toggleSpeedControls}
        class="flex w-full items-center justify-between rounded-lg px-4 py-3 font-medium transition-all duration-200 hover:bg-white/10"
      >
        <span class="flex items-center">
          <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"></path>
          </svg>
          Ship Speed: {getSpeedText()}
        </span>
        <svg
          class="h-5 w-5 transition-transform duration-200"
          style={{
            transform: showSpeedControls() ? "rotate(180deg)" : "rotate(0deg)",
          }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </button>

      {showSpeedControls() && (
        <div class="mt-2 px-4 pb-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs opacity-80">Slow</span>
            <span class="text-xs opacity-80">Fast</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={shipSpeed()}
            onInput={handleSpeedChange}
            class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-green-400"
          />
          <div class="flex justify-between mt-1">
            <button
              onClick={() => setShipSpeed(0.5)}
              class="text-xs px-2 py-1 rounded hover:bg-white/20"
            >
              0.5x
            </button>
            <button
              onClick={() => setShipSpeed(1.0)}
              class="text-xs px-2 py-1 rounded hover:bg-white/20"
            >
              1.0x
            </button>
            <button
              onClick={() => setShipSpeed(2.0)}
              class="text-xs px-2 py-1 rounded hover:bg-white/20"
            >
              2.0x
            </button>
            <button
              onClick={() => setShipSpeed(3.0)}
              class="text-xs px-2 py-1 rounded hover:bg-white/20"
            >
              3.0x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
