import { createMemo } from "solid-js";
import { HEIGHT, getHeightColor, getHeightStatus } from "../../constants/world";

const AltitudePanel = (props) => {
  // Helper for UI height bar - ensure proper calculation of fill height
  const getHeightBarStyle = createMemo(() => {
    const height = props.shipHeight;
    // Calculate percentage based on min/max range
    const normalizedHeight = Math.max(
      0,
      Math.min(1, (height - HEIGHT.MIN) / (HEIGHT.MAX - HEIGHT.MIN))
    );

    return {
      height: `${normalizedHeight * 100}%`,
      "background-color": getHeightColor(height),
      "z-index": 1,
    };
  });

  // Create a memo for the status object
  const heightStatus = createMemo(() => getHeightStatus(props.shipHeight));

  return (
    <div class="absolute top-1/2 right-4 -translate-y-1/2 text-white font-mono pointer-events-none w-28">
      {/* <div class="text-center text-xs mb-1 font-bold tracking-widest drop-shadow-md">
        ALTITUDE
      </div> */}
      <div class="flex justify-center">
        {/* Thermometer with clean design and stronger border */}
        <div class="relative w-5 h-44 bg-black/50   overflow-hidden mb-1 shadow-md">
          {/* Colored fluid inside thermometer */}
          <div
            class="absolute bottom-0 left-0 right-0 "
            style={getHeightBarStyle()}
          ></div>
          {/* Simple glass reflection */}
          <div
            class="absolute top-0 left-0 w-1/2 h-full bg-white/10 rounded-l-full"
            style={{ "z-index": 2 }}
          ></div>
          {/* Height labels with better contrast */}
          <div class="absolute right-full top-0 h-full flex flex-col justify-between pr-2 text-xs font-bold">
            <div class="bg-black/30 px-1 rounded">{HEIGHT.MAX}m</div>
            <div></div>
            <div class="bg-black/30 px-1 rounded">{HEIGHT.MIN}m</div>
          </div>
        </div>
      </div>
      {/* Current height display with improved contrast */}
      <div
        class="text-base font-bold text-center px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/20 mb-1 mx-auto"
        style={{
          color: getHeightColor(props.shipHeight),
        }}
      >
        {props.shipHeight.toFixed(1)}m
      </div>
      {/* Simple status indicator with fixed height and overflow handling */}
      <div class="text-center text-xs font-medium bg-black/40 rounded px-2 py-0.5 h-5 flex items-center justify-center">
        <span class={heightStatus().color + " whitespace-nowrap"}>
          {heightStatus().icon} {heightStatus().text}
        </span>
      </div>
    </div>
  );
};

export default AltitudePanel;
