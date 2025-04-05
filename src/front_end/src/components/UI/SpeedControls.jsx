import { navigationStore } from "../../stores/navigationStore";

export default function SpeedControls() {
  const { shipSpeed, setShipSpeed } = navigationStore;

  // Handle speed change
  const handleSpeedChange = (e) => {
    setShipSpeed(parseFloat(e.target.value));
  };

  // Get formatted speed text
  const getSpeedText = () => {
    return `${shipSpeed().toFixed(1)}x`;
  };

  return (
    <div class="absolute bottom-4 right-4 transform  bg-black/30 backdrop-blur-sm rounded-lg border border-cyan-500/30 shadow-lg text-white z-10 px-4 py-2">
      <div class="flex items-center gap-3">
        <svg
          class="h-4 w-4 text-cyan-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"></path>
        </svg>

        <div class="flex flex-col w-48">
          <div class="flex justify-between mb-1">
            <span class="text-xs">Ship Speed: {getSpeedText()}</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              onClick={() => setShipSpeed(0.5)}
              class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
            >
              0.5x
            </button>

            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={shipSpeed()}
              onInput={handleSpeedChange}
              class="w-full h-1 rounded-lg appearance-none cursor-pointer accent-green-400"
            />

            <button
              onClick={() => setShipSpeed(2.0)}
              class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
            >
              2.0x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
