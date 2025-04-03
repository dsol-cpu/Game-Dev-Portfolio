import { createEffect } from "solid-js";
import { HEIGHT, getHeightColor, getHeightStatus } from "../../constants/world";

/**
 * Altitude display UI component
 */
const AltitudePanel = (props) => {
  // Helper for UI height bar
  const getHeightBarStyle = (height) => {
    const normalizedHeight = Math.max(
      0,
      Math.min(1, (height - HEIGHT.MIN) / (HEIGHT.MAX - HEIGHT.MIN))
    );

    // Return proper styles with the correct syntax
    return {
      height: `${normalizedHeight * 100}%`,
      "background-color": getHeightColor(height),
    };
  };

  return (
    <div class="absolute top-4 right-4 bg-black bg-opacity-60 rounded-lg p-4 text-white font-mono pointer-events-none w-64">
      <div class="text-center mb-2 font-bold">ALTITUDE</div>

      <div class="flex items-center">
        {/* Vertical bar indicator - removed transition effect */}
        <div class="relative w-6 h-48 bg-gray-800 rounded-full overflow-hidden mr-3">
          <div
            class="absolute bottom-0 w-full rounded-b-full"
            style={getHeightBarStyle(props.shipHeight)}
          ></div>
        </div>

        {/* Height values */}
        <div class="flex flex-col justify-between h-48">
          <div class="text-xs text-red-400">{HEIGHT.MAX}m</div>
          <div class="text-xs text-orange-400">30m</div>
          <div class="text-xs text-green-400">0m</div>
          <div class="text-xs text-blue-400">-15m</div>
          <div class="text-xs text-blue-800">{HEIGHT.MIN}m</div>
        </div>

        {/* Current height display */}
        <div class="ml-4 text-right min-w-20">
          <div
            class="text-lg font-bold"
            style={{ color: getHeightColor(props.shipHeight) }}
          >
            {props.shipHeight.toFixed(1)}m
          </div>
          <div class="text-xs mt-1 w-16">
            {props.shipHeight > 0 ? "ALTITUDE" : "DEPTH"}
          </div>
        </div>
      </div>

      {/* Status text based on altitude - fixed width container */}
      <div class="mt-2 text-center text-sm w-full">
        <span class={getHeightStatus(props.shipHeight).color}>
          {getHeightStatus(props.shipHeight).icon}{" "}
          {getHeightStatus(props.shipHeight).text}
        </span>
      </div>
    </div>
  );
};

export default AltitudePanel;
