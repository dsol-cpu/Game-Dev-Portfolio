import { HEIGHT, getHeightColor, getHeightStatus } from "../../constants/world";

const AltitudePanel = (props) => {
  // Helper for UI height bar - ensure proper calculation of fill height
  const getHeightBarStyle = (height) => {
    // Calculate percentage based on min/max range
    const normalizedHeight = Math.max(
      0,
      Math.min(1, (height - HEIGHT.MIN) / (HEIGHT.MAX - HEIGHT.MIN))
    );

    // Return the style object with explicit z-index to ensure visibility
    // No transition properties to ensure immediate updates
    return {
      height: `${normalizedHeight * 100}%`,
      "background-color": getHeightColor(height),
      "z-index": 1,
    };
  };

  return (
    <div class="absolute top-4 right-4 text-white font-mono pointer-events-none w-24">
      {/* Title with drop shadow for visibility */}
      <div class="text-center text-xs mb-1 font-bold text-shadow">ALTITUDE</div>

      <div class="flex justify-center">
        {/* Thermometer style tube with glass-like appearance */}
        <div class="relative w-4 h-40 bg-white/10 backdrop-blur-sm border border-white/30 rounded-full overflow-hidden mb-1">
          {/* Colored fluid inside thermometer - removed transition for immediate fill */}
          <div
            class="absolute bottom-0 left-0 right-0 rounded-b-full"
            style={getHeightBarStyle(props.shipHeight)}
          ></div>

          {/* Glass reflection effect */}
          <div
            class="absolute top-0 left-0 w-1/2 h-full bg-white/10 rounded-l-full"
            style={{ "z-index": 2 }}
          ></div>

          {/* Tick marks */}
          <div
            class="absolute w-full h-full flex flex-col justify-between pointer-events-none"
            style={{ "z-index": 3 }}
          >
            <div class="h-px w-2 bg-white/70 self-end mr-0.5"></div>
            <div class="h-px w-2 bg-white/70 self-end mr-0.5"></div>
            <div class="h-px w-2 bg-white/70 self-end mr-0.5"></div>
          </div>

          {/* Minimal key values with drop shadow for visibility */}
          <div class="absolute right-full top-0 h-full flex flex-col justify-between pr-1 text-xs text-shadow">
            <div>{HEIGHT.MAX}m</div>
            <div>0m</div>
            <div>{HEIGHT.MIN}m</div>
          </div>
        </div>
      </div>

      {/* Current height value with fixed width background pill for visibility */}
      <div
        class="text-sm font-bold text-center px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 mb-1 mx-auto"
        style={{
          color: getHeightColor(props.shipHeight),
          width: "100%",
        }}
      >
        {props.shipHeight.toFixed(1)}m
      </div>

      {/* Status text with fixed width background for visibility */}
      <div
        class="text-center text-xs px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 mx-auto"
        style={{ width: "100%" }}
      >
        <span class={getHeightStatus(props.shipHeight).color}>
          {getHeightStatus(props.shipHeight).icon}{" "}
          {getHeightStatus(props.shipHeight).text}
        </span>
      </div>
    </div>
  );
};

export default AltitudePanel;
