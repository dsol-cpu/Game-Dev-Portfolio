import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { Icon } from "../icons/Icon";

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
  // Add state variables to track button press status
  const [upButtonPressed, setUpButtonPressed] = createSignal(false);
  const [downButtonPressed, setDownButtonPressed] = createSignal(false);

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
    document.addEventListener("touchstart", function () {}, { passive: false });
    document.addEventListener("touchmove", function () {}, { passive: false });

    onCleanup(() => {
      window.removeEventListener("resize", checkMobile);
    });
  });

  // Joystick controls
  const handleJoystickStart = (e) => {
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

  // Altitude button handlers with color change
  const handleAltitudeUpStart = (e) => {
    if (e.cancelable) e.preventDefault();
    setUpButtonPressed(true); // Set button state to pressed
    if (props.onAltitudeUp) {
      props.onAltitudeUp();
    }
  };

  const handleAltitudeDownStart = (e) => {
    if (e.cancelable) e.preventDefault();
    setDownButtonPressed(true); // Set button state to pressed
    if (props.onAltitudeDown) {
      props.onAltitudeDown();
    }
  };

  const handleAltitudeEnd = (e) => {
    if (e.cancelable) e.preventDefault();
    // Reset both button states
    setUpButtonPressed(false);
    setDownButtonPressed(false);
    if (props.onAltitudeStop) {
      props.onAltitudeStop();
    }
  };

  return (
    <Show when={isMobile()}>
      <div class="absolute inset-x-0 bottom-0 p-4 flex justify-between z-50 pointer-events-none w-full">
        {/* Left side - Joystick as SVG */}
        <div
          class="w-32 h-32 pointer-events-auto touch-manipulation"
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          style={{ overflow: "visible" }} // Allow the SVG to overflow the parent div
        >
          <svg
            viewBox="0 0 128 128"
            width="100%"
            height="100%"
            class="w-full h-full"
            style={{ overflow: "visible" }} // Ensure SVG elements are not clipped
          >
            {/* Base circle */}
            <circle cx="64" cy="64" r="64" fill="rgba(0, 0, 0, 0.3)" />

            {/* Joystick knob */}
            <g
              transform={`translate(${64 + joystickPosition().x}, ${64 + joystickPosition().y})`}
              style={{
                transition: joystickActive()
                  ? "none"
                  : "transform 0.2s ease-out",
              }}
            >
              <circle
                cx="0"
                cy="0"
                r="32"
                fill="rgba(255, 255, 255, 0.8)"
                stroke="#555"
                stroke-width="1"
              />
            </g>
          </svg>
        </div>

        {/* Right side - Altitude buttons as SVG */}
        <div class="flex flex-col gap-4 pointer-events-auto">
          {/* UP button */}
          <button
            class="w-16 h-16 touch-manipulation focus:outline-none"
            onTouchStart={handleAltitudeUpStart}
            onTouchEnd={handleAltitudeEnd}
            onTouchCancel={handleAltitudeEnd}
            aria-label="Up"
            onMouseDown={handleAltitudeUpStart}
            onMouseUp={handleAltitudeEnd}
            onMouseOut={handleAltitudeEnd}
            style={{
              transition: "transform 0.2s ease, background-color 0.2s ease",
              transform: upButtonPressed() ? "scale(0.95)" : "scale(1)",
            }}
          >
            <Icon
              name="up_button"
              size="64"
              color={upButtonPressed() ? "#4CAF50" : "#FFFFFF"}
            />
          </button>

          {/* DOWN button */}
          <button
            class="w-16 h-16 touch-manipulation focus:outline-none"
            onTouchStart={handleAltitudeDownStart}
            onTouchEnd={handleAltitudeEnd}
            onTouchCancel={handleAltitudeEnd}
            aria-label="Down"
            onMouseDown={handleAltitudeDownStart}
            onMouseUp={handleAltitudeEnd}
            onMouseOut={handleAltitudeEnd}
            style={{
              transition: "transform 0.2s ease, background-color 0.2s ease",
              transform: downButtonPressed() ? "scale(0.95)" : "scale(1)",
            }}
          >
            <Icon
              name="down_button"
              size="64"
              color={downButtonPressed() ? "#FF5722" : "#FFFFFF"}
            />
          </button>
        </div>
      </div>
    </Show>
  );
};

export default MobileControls;
