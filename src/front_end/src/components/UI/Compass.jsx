import { createSignal, createEffect } from "solid-js";

const Compass = (props) => {
  const [direction, setDirection] = createSignal("N");
  const [rotation, setRotation] = createSignal(0);

  // Convert rotation in radians to compass direction
  const getCompassDirection = (radians) => {
    // Normalize radians to 0-2π range
    const normalized =
      ((radians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Convert to degrees (0-360)
    const degrees = (normalized * 180) / Math.PI;

    // Determine direction based on degrees
    if (degrees >= 337.5 || degrees < 22.5) return "N";
    if (degrees >= 22.5 && degrees < 67.5) return "NE";
    if (degrees >= 67.5 && degrees < 112.5) return "E";
    if (degrees >= 112.5 && degrees < 157.5) return "SE";
    if (degrees >= 157.5 && degrees < 202.5) return "S";
    if (degrees >= 202.5 && degrees < 247.5) return "SW";
    if (degrees >= 247.5 && degrees < 292.5) return "W";
    if (degrees >= 292.5 && degrees < 337.5) return "NW";
    return "N";
  };

  createEffect(() => {
    if (props.rotation !== undefined) {
      setRotation(props.rotation);
      setDirection(getCompassDirection(props.rotation));
    }
  });

  return (
    <div class="absolute top-4 left-4 flex flex-col items-center">
      <div class="relative w-16 h-16 bg-gradient-to-b from-blue-800 to-blue-950 rounded-full border-2 border-yellow-600 shadow-lg overflow-hidden">
        {/* Compass face */}
        <div
          class="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${-rotation()}rad)` }}
        >
          {/* Cardinal directions */}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="absolute top-2 text-sm font-bold text-yellow-400">
              N
            </div>
            <div class="absolute right-2 text-sm font-bold text-amber-100">
              E
            </div>
            <div class="absolute bottom-2 text-sm font-bold text-amber-100">
              S
            </div>
            <div class="absolute left-2 text-sm font-bold text-amber-100">
              W
            </div>
          </div>

          {/* Compass rose */}
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <line
              x1="50"
              y1="10"
              x2="50"
              y2="90"
              stroke="rgba(255,255,255,0.2)"
              stroke-width="1"
            />
            <line
              x1="10"
              y1="50"
              x2="90"
              y2="50"
              stroke="rgba(255,255,255,0.2)"
              stroke-width="1"
            />

            {/* Directional arrow */}
            <polygon
              points="50,20 45,40 50,35 55,40"
              fill="#FF6B35"
              stroke="#FF6B35"
            />
          </svg>
        </div>
      </div>

      {/* Current direction text */}
      <div class="mt-1 px-3 py-1 bg-blue-900 text-amber-100 rounded-md border border-yellow-600 font-bold">
        {direction()}
      </div>
    </div>
  );
};

export default Compass;
