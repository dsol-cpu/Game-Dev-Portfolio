import { navigationStore } from "../../stores/navigation";
import { Icon } from "../icons/Icon";
export default function SpeedControls() {
  const { shipSpeed, setShipSpeed } = navigationStore;

  const handleSpeedChange = (e) => {
    setShipSpeed(parseFloat(e.target.value));
  };

  const getSpeedText = () => {
    return `${shipSpeed().toFixed(1)}x`;
  };

  return (
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-sm rounded-lg border border-cyan-500/30 shadow-lg text-white z-10 px-4 py-2">
      <div class="flex items-center gap-3">
        <Icon name="speedometer" />

        <div class="flex flex-col w-48">
          <div class="flex items-center gap-2 focus:outline-none">
            <button
              onClick={() => setShipSpeed(0.5)}
              class="focus:outline-none select-none text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
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
              class="select-none text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
            >
              2.0x
            </button>
          </div>
          <div class="flex self-center justify-between mb-1">
            <span class="select-none text-xs">{getSpeedText()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
