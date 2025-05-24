import { debounce } from "./utils/helper.js";
import {
  toggleAudio,
  setVolume,
  getVolume,
  isAudioEnabled,
  isMusicPlaying,
  playMusic,
  pauseMusic,
  stopMusic,
  hasUserInteracted,
  getCurrentTrackTitle,
  skipToNextTrack,
  skipToPreviousTrack,
} from "./three/audio.js";

// Media Player Configuration
const MEDIA_CONFIG = {
  width: 380, // Increased width to accommodate skip buttons
  height: 80, // Height for title display
  padding: 12,
  borderRadius: 8,
  buttonSize: 36,
  sliderWidth: 100,
  gap: 10,
};

const MEDIA_THEME = {
  bg: "rgba(34, 51, 68, 0.85)",
  border: "rgba(155, 179, 205, 0.9)",
  text: "rgba(225, 235, 245, 0.95)",
  accent: "#c5a45c",
  hover: "#e5b668",
  disabled: "rgba(155, 179, 205, 0.4)",
  playing: "#4ade80",
  paused: "#f59e0b",
  titleText: "rgba(225, 235, 245, 0.8)",
};

// Pure DOM element creation helpers
const createElement = (tag, props = {}, children = []) => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  Object.assign(el.style, props.style || {});
  children.forEach((child) => el.appendChild(child));
  return el;
};

const createButton = (id, innerHTML, title, onClick, extraStyles = {}) =>
  createElement("button", {
    id,
    innerHTML,
    title,
    className: "media-player-btn",
    onclick: onClick,
    style: {
      background: "none",
      border: "none",
      fontSize: "18px",
      cursor: "pointer",
      color: MEDIA_THEME.text,
      opacity: "0.9",
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: `${MEDIA_CONFIG.buttonSize}px`,
      height: `${MEDIA_CONFIG.buttonSize}px`,
      borderRadius: "4px",
      flexShrink: 0,
      ...extraStyles,
    },
  });

const createSlider = (id, props, onInput, extraStyles = {}) =>
  createElement("input", {
    ...props,
    id,
    type: "range",
    className: "media-player-slider",
    oninput: onInput,
    style: {
      width: `${MEDIA_CONFIG.sliderWidth}px`,
      cursor: "pointer",
      accentColor: MEDIA_THEME.accent,
      transition: "opacity 0.2s",
      flexShrink: 0,
      ...extraStyles,
    },
  });

// Icon helpers
const getPlayPauseIcon = () => {
  const isPlaying = isMusicPlaying();
  return isPlaying ? "⏸️" : "▶️";
};

const getVolumeIcon = (audioEnabled, volume) => {
  if (!audioEnabled || volume === 0) return "🔇";
  if (volume < 0.3) return "🔈";
  if (volume < 0.7) return "🔉";
  return "🔊";
};

// Get current track title with fallback
const getCurrentTitle = () => {
  try {
    // Try to get from audio module - you'll need to implement getCurrentTrackTitle()
    return getCurrentTrackTitle() || "No Track Playing";
  } catch (error) {
    // Fallback if function doesn't exist
    return isMusicPlaying() ? "Music Playing" : "No Track Playing";
  }
};

// Event handlers
function handlePlayPauseClick() {
  const isPlaying = isMusicPlaying();
  const audioEnabled = isAudioEnabled();

  if (!audioEnabled) {
    toggleAudio().then(() => {
      updateMediaPlayerUI();
    });
    return;
  }

  if (isPlaying) {
    pauseMusic();
  } else {
    playMusic();
  }

  updateMediaPlayerUI();
}

function handleStopClick() {
  stopMusic();
  updateMediaPlayerUI();
}

function handleSkipForwardClick() {
  try {
    skipToNextTrack();
    updateMediaPlayerUI();
  } catch (error) {
    console.warn("Skip forward not available:", error);
  }
}

function handleSkipBackwardClick() {
  try {
    skipToPreviousTrack();
    updateMediaPlayerUI();
  } catch (error) {
    console.warn("Skip backward not available:", error);
  }
}

function handleVolumeIconClick() {
  toggleAudio().then(() => {
    updateMediaPlayerUI();
  });
}

function handleVolumeChange(e) {
  const newVolume = parseFloat(e.target.value);
  setVolume(newVolume);
  updateMediaPlayerUI();
}

// Update functions
const updatePlayPauseButton = (button) => {
  if (!button) return;

  const isPlaying = isMusicPlaying();
  const audioEnabled = isAudioEnabled();
  const hasInteracted = hasUserInteracted();

  button.innerHTML = getPlayPauseIcon();
  button.title = isPlaying ? "Pause" : "Play";

  if (isPlaying) {
    button.style.color = MEDIA_THEME.playing;
    button.style.backgroundColor = "rgba(74, 222, 128, 0.1)";
  } else if (audioEnabled && hasInteracted) {
    button.style.color = MEDIA_THEME.paused;
    button.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
  } else {
    button.style.color = MEDIA_THEME.text;
    button.style.backgroundColor = "transparent";
  }

  button.disabled = !hasInteracted && !audioEnabled;
  button.style.opacity = button.disabled ? "0.5" : "0.9";
};

const updateStopButton = (button) => {
  if (!button) return;

  const isPlaying = isMusicPlaying();
  const audioEnabled = isAudioEnabled();
  const hasInteracted = hasUserInteracted();

  button.disabled = !isPlaying || !audioEnabled || !hasInteracted;
  button.style.opacity = button.disabled ? "0.5" : "0.9";
  button.style.color = button.disabled
    ? MEDIA_THEME.disabled
    : MEDIA_THEME.text;
};

const updateSkipButtons = (skipForwardBtn, skipBackwardBtn) => {
  const audioEnabled = isAudioEnabled();
  const hasInteracted = hasUserInteracted();
  const canSkip = audioEnabled && hasInteracted;

  [skipForwardBtn, skipBackwardBtn].forEach((button) => {
    if (!button) return;

    button.disabled = !canSkip;
    button.style.opacity = button.disabled ? "0.5" : "0.9";
    button.style.color = button.disabled
      ? MEDIA_THEME.disabled
      : MEDIA_THEME.text;
  });
};

const updateVolumeIcon = (button) => {
  if (!button) return;

  const audioEnabled = isAudioEnabled();
  const volume = getVolume();

  button.innerHTML = getVolumeIcon(audioEnabled, volume);
  button.style.color = audioEnabled ? MEDIA_THEME.accent : MEDIA_THEME.text;
};

const updateVolumeSlider = (slider) => {
  if (!slider) return;

  const audioEnabled = isAudioEnabled();
  const volume = getVolume();

  if (slider.value !== volume.toString()) {
    slider.value = volume.toString();
  }

  slider.disabled = !audioEnabled;
  slider.style.opacity = audioEnabled ? "1" : "0.5";
  slider.style.cursor = audioEnabled ? "pointer" : "not-allowed";
};

const updateTrackTitle = (titleElement) => {
  if (!titleElement) return;

  const title = getCurrentTitle();
  titleElement.textContent = title;

  // Add visual indication if playing
  const isPlaying = isMusicPlaying();
  titleElement.style.color = isPlaying
    ? MEDIA_THEME.accent
    : MEDIA_THEME.titleText;
};

// Create media player container
const createMediaPlayer = () => {
  const audioEnabled = isAudioEnabled();
  const volume = getVolume();
  const hasInteracted = hasUserInteracted();

  // Main container
  const container = createElement("div", {
    id: "media-player-container",
    className: "game-ui-element",
    style: {
      display: "flex",
      flexDirection: "column",
      backgroundColor: MEDIA_THEME.bg,
      padding: `${MEDIA_CONFIG.padding}px`,
      borderRadius: `${MEDIA_CONFIG.borderRadius}px`,
      border: `1px solid ${MEDIA_THEME.border}`,
      pointerEvents: "auto",
      backdropFilter: "blur(8px)",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      minWidth: `${MEDIA_CONFIG.width}px`,
      gap: "8px",
    },
  });

  // Track title display
  const trackTitle = createElement("div", {
    id: "media-track-title",
    style: {
      fontSize: "12px",
      fontWeight: "500",
      color: MEDIA_THEME.titleText,
      textAlign: "center",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "100%",
      lineHeight: "1.2",
      minHeight: "14px",
    },
  });
  trackTitle.textContent = getCurrentTitle();

  // Controls row
  const controlsRow = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: `${MEDIA_CONFIG.gap}px`,
    },
  });

  // Control buttons section
  const controlsSection = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
  });

  // Skip backward button
  const skipBackwardButton = createButton(
    "media-skip-backward-btn",
    "⏮️",
    "Previous Track",
    handleSkipBackwardClick,
    {
      fontSize: "18px",
    }
  );

  // Play/Pause button
  const playPauseButton = createButton(
    "media-play-pause-btn",
    getPlayPauseIcon(),
    isMusicPlaying() ? "Pause" : "Play",
    handlePlayPauseClick,
    {
      fontSize: "20px",
      color: !hasInteracted ? MEDIA_THEME.disabled : MEDIA_THEME.text,
    }
  );

  // Stop button
  const stopButton = createButton(
    "media-stop-btn",
    "⏹️",
    "Stop",
    handleStopClick,
    {
      fontSize: "16px",
    }
  );

  // Skip forward button
  const skipForwardButton = createButton(
    "media-skip-forward-btn",
    "⏭️",
    "Next Track",
    handleSkipForwardClick,
    {
      fontSize: "18px",
    }
  );

  controlsSection.appendChild(skipBackwardButton);
  controlsSection.appendChild(playPauseButton);
  controlsSection.appendChild(stopButton);
  controlsSection.appendChild(skipForwardButton);

  // Volume section
  const volumeSection = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
  });

  // Volume icon button
  const volumeButton = createButton(
    "media-volume-btn",
    getVolumeIcon(audioEnabled, volume),
    "Toggle Audio",
    handleVolumeIconClick,
    {
      fontSize: "16px",
    }
  );

  // Volume slider
  const volumeSlider = createSlider(
    "media-volume-slider",
    {
      min: "0",
      max: "1",
      step: "0.05",
      value: volume.toString(),
      disabled: !audioEnabled,
    },
    debounce(handleVolumeChange, 50),
    {
      opacity: audioEnabled ? "1" : "0.5",
      cursor: audioEnabled ? "pointer" : "not-allowed",
    }
  );

  volumeSection.appendChild(volumeButton);
  volumeSection.appendChild(volumeSlider);

  // Status indicator
  const statusIndicator = createElement("div", {
    id: "media-status-indicator",
    style: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: hasInteracted
        ? MEDIA_THEME.accent
        : MEDIA_THEME.disabled,
      opacity: "0.6",
      flexShrink: 0,
      title: hasInteracted ? "Audio Ready" : "Click to enable audio",
    },
  });

  // Assemble the controls row
  controlsRow.appendChild(controlsSection);
  controlsRow.appendChild(volumeSection);
  controlsRow.appendChild(statusIndicator);

  // Assemble the player
  container.appendChild(trackTitle);
  container.appendChild(controlsRow);

  return container;
};

// Create styles for the media player
const createMediaPlayerStyles = () => {
  if (document.getElementById("media-player-styles")) return;

  const style = createElement("style", {
    id: "media-player-styles",
    textContent: `
      .game-ui-element {
        pointer-events: none;
        border-radius: ${MEDIA_CONFIG.borderRadius}px;
        will-change: transform;
      }

      #media-player-container {
        pointer-events: auto;
        user-select: none;
      }

      .media-player-btn:hover {
        opacity: 1 !important;
        background-color: rgba(197, 164, 92, 0.1) !important;
        transform: scale(1.05);
      }

      .media-player-btn:active {
        transform: scale(0.95);
      }

      .media-player-btn:disabled {
        cursor: not-allowed !important;
        transform: none !important;
      }

      .media-player-btn:disabled:hover {
        background-color: transparent !important;
        transform: none !important;
      }

      .media-player-slider::-webkit-slider-thumb {
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${MEDIA_THEME.accent};
        cursor: pointer;
        border: 2px solid ${MEDIA_THEME.bg};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .media-player-slider::-webkit-slider-track {
        appearance: none;
        height: 4px;
        border-radius: 2px;
        background: rgba(155, 179, 205, 0.3);
      }

      .media-player-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${MEDIA_THEME.accent};
        cursor: pointer;
        border: 2px solid ${MEDIA_THEME.bg};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .media-player-slider::-moz-range-track {
        height: 4px;
        border-radius: 2px;
        background: rgba(155, 179, 205, 0.3);
      }

      .media-player-slider:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      #media-track-title {
        transition: color 0.3s ease;
      }

      @keyframes pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }

      @keyframes marquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }

      #media-track-title.scrolling {
        animation: marquee 10s linear infinite;
      }

      #media-status-indicator.loading {
        animation: pulse 1s infinite;
      }
    `,
  });

  document.head.appendChild(style);
};

// Position the media player - Updated to center bottom
const positionMediaPlayer = (container, mediaPlayer) => {
  if (!container || !mediaPlayer) return;

  const rect = container.getBoundingClientRect();

  Object.assign(mediaPlayer.style, {
    position: "absolute",
    bottom: `${MEDIA_CONFIG.padding}px`,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "10",
  });
};

// Main update function
export const updateMediaPlayerUI = () => {
  const playPauseBtn = document.getElementById("media-play-pause-btn");
  const stopBtn = document.getElementById("media-stop-btn");
  const skipForwardBtn = document.getElementById("media-skip-forward-btn");
  const skipBackwardBtn = document.getElementById("media-skip-backward-btn");
  const volumeBtn = document.getElementById("media-volume-btn");
  const volumeSlider = document.getElementById("media-volume-slider");
  const statusIndicator = document.getElementById("media-status-indicator");
  const trackTitle = document.getElementById("media-track-title");

  updatePlayPauseButton(playPauseBtn);
  updateStopButton(stopBtn);
  updateSkipButtons(skipForwardBtn, skipBackwardBtn);
  updateVolumeIcon(volumeBtn);
  updateVolumeSlider(volumeSlider);
  updateTrackTitle(trackTitle);

  // Update status indicator
  if (statusIndicator) {
    const hasInteracted = hasUserInteracted();
    statusIndicator.style.backgroundColor = hasInteracted
      ? MEDIA_THEME.accent
      : MEDIA_THEME.disabled;
    statusIndicator.title = hasInteracted
      ? "Audio Ready"
      : "Click to enable audio";
  }
};

// Initialize media player
export const initMediaPlayer = (elements) => {
  if (!elements?.gameViewContainer) {
    console.error("Media Player init failed: no container");
    return;
  }

  const container = elements.gameViewContainer;
  const mediaPlayer = createMediaPlayer();

  // Add to container
  container.appendChild(mediaPlayer);

  // Position the player
  positionMediaPlayer(container, mediaPlayer);

  // Add styles
  createMediaPlayerStyles();

  // Handle resize
  const debouncedResize = debounce(
    () => positionMediaPlayer(container, mediaPlayer),
    200
  );
  window.addEventListener("resize", debouncedResize, { passive: true });

  // Initial UI update
  updateMediaPlayerUI();

  // Return cleanup function
  return () => {
    window.removeEventListener("resize", debouncedResize);
    mediaPlayer.remove();
    const styles = document.getElementById("media-player-styles");
    if (styles) styles.remove();
  };
};

// Sync media player with audio state (call this when audio state changes externally)
export const syncMusicPlayerUI = () => {
  updateMediaPlayerUI();
};

// Dispose media player
export const disposeMediaPlayer = () => {
  const mediaPlayer = document.getElementById("media-player-container");
  if (mediaPlayer) mediaPlayer.remove();

  const styles = document.getElementById("media-player-styles");
  if (styles) styles.remove();
};

// Export the media player creation function for direct use
export const getMediaPlayer = () => createMediaPlayer();
