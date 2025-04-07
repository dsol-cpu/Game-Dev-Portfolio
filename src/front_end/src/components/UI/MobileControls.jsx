import { createSignal, Show, onMount, onCleanup } from "solid-js";

const MobileControls = (props) => {
  const [touchStartPosition, setTouchStartPosition] = createSignal({
    x: 0,
    y: 0,
  });
  const [joystickPosition, setJoystickPosition] = createSignal({ x: 0, y: 0 });
  const [joystickActive, setJoystickActive] = createSignal(false);
  const [doubleTapTimer, setDoubleTapTimer] = createSignal(null);
  const [lastTapTime, setLastTapTime] = createSignal(0);
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

    // Handle passive event listener setting for the entire document's touch events
    // This is a global approach that affects all touch events
    document.addEventListener("touchstart", function () {}, { passive: false });
    document.addEventListener("touchmove", function () {}, { passive: false });

    onCleanup(() => {
      window.removeEventListener("resize", checkMobile);
    });
  });

  // Joystick controls
  const handleJoystickStart = (e) => {
    // Don't call preventDefault unconditionally - only when needed
    if (e.cancelable) e.preventDefault();

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    setTouchStartPosition({ x: centerX, y: centerY });
    setJoystickPosition({ x: 0, y: 0 });
    setJoystickActive(true);

    // Check for double tap to reset orientation
    const now = new Date().getTime();
    const timeSinceLastTap = now - lastTapTime();

    if (timeSinceLastTap < 300) {
      // Double tap detected
      if (props.onOrientationReset) {
        props.onOrientationReset();
      }
      clearTimeout(doubleTapTimer());
      setDoubleTapTimer(null);
    } else {
      // Single tap, start timer for potential double tap
      setDoubleTapTimer(
        setTimeout(() => {
          setDoubleTapTimer(null);
        }, 300)
      );
    }

    setLastTapTime(now);
  };

  const handleJoystickMove = (e) => {
    if (e.cancelable) e.preventDefault();
    if (!joystickActive()) return;

    const touch = e.touches[0];
    const maxDistance = 50; // Max joystick travel distance

    // Calculate distance from center
    const dx = touch.clientX - touchStartPosition().x;
    const dy = touch.clientY - touchStartPosition().y;

    // Calculate distance from center
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize if distance is greater than max
    let normX = dx;
    let normY = dy;

    if (distance > maxDistance) {
      normX = (dx / distance) * maxDistance;
      normY = (dy / distance) * maxDistance;
    }

    // Update joystick position
    setJoystickPosition({ x: normX, y: normY });

    // Calculate normalized input values (-1 to 1)
    const inputX = normX / maxDistance;
    const inputY = -normY / maxDistance; // Invert Y axis: up is forward

    // Send movement values to props
    if (props.onMove) {
      props.onMove(inputX, inputY);
    }
  };

  const handleJoystickEnd = (e) => {
    if (e.cancelable) e.preventDefault();
    setJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });

    // Reset movement
    if (props.onMove) {
      props.onMove(0, 0);
    }
  };

  // Altitude button handlers
  const handleAltitudeUpStart = (e) => {
    if (e.cancelable) e.preventDefault();
    if (props.onAltitudeUp) {
      props.onAltitudeUp();
    }
  };

  const handleAltitudeDownStart = (e) => {
    if (e.cancelable) e.preventDefault();
    if (props.onAltitudeDown) {
      props.onAltitudeDown();
    }
  };

  const handleAltitudeEnd = (e) => {
    if (e.cancelable) e.preventDefault();
    if (props.onAltitudeStop) {
      props.onAltitudeStop();
    }
  };

  return (
    <Show when={isMobile()}>
      <div class="absolute inset-x-0 bottom-0 p-4 flex justify-between z-50 pointer-events-none w-full">
        {/* Left side - Joystick */}
        <div
          class="w-32 h-32 bg-black bg-opacity-30 rounded-full flex items-center justify-center pointer-events-auto touch-manipulation"
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
        >
          <div
            class="w-16 h-16 bg-white bg-opacity-80 rounded-full flex items-center justify-center"
            style={{
              transform: `translate(${joystickPosition().x}px, ${joystickPosition().y}px)`,
              transition: joystickActive() ? "none" : "transform 0.2s ease-out",
            }}
          >
            <span class="text-xs font-bold text-gray-800">MOVE</span>
          </div>
        </div>

        {/* Right side - Altitude buttons */}
        <div class="flex flex-col gap-4 pointer-events-auto">
          <button
            class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg touch-manipulation"
            onTouchStart={handleAltitudeUpStart}
            onTouchEnd={handleAltitudeEnd}
            onTouchCancel={handleAltitudeEnd}
          >
            UP
          </button>
          <button
            class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg touch-manipulation"
            onTouchStart={handleAltitudeDownStart}
            onTouchEnd={handleAltitudeEnd}
            onTouchCancel={handleAltitudeEnd}
          >
            DOWN
          </button>
        </div>
      </div>
    </Show>
  );
};

export default MobileControls;
