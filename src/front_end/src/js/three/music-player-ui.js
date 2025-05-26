import { random } from "../utils/random.js";
import {
  toggleAudio,
  setVolume,
  getVolume,
  isAudioEnabled,
  playMusic,
  pauseMusic,
  stopMusic,
  isMusicPlaying,
  addMusic,
  initAudio,
  getCurrentTrackIndex,
  loadAndPlayTrack,
  playNextTrack,
  playPreviousTrack,
  getPlaylist,
  getCurrentPosition,
  getDuration,
  hasUserInteracted,
  setUserInteracted,
  seekTo,
} from "./audio.js";

// Constants
const MUSIC_CONFIG = {
  width: 480,
  height: 80,
  padding: 20,
  spacing: 10,
  controlSize: 36,
  smallControlSize: 28,
  borderRadius: 16,
  volumeSliderWidth: 100,
};

const MUSIC_THEME = {
  bg: "linear-gradient(135deg, rgba(15, 20, 30, 0.95) 0%, rgba(25, 35, 50, 0.95) 100%)",
  border: "rgba(100, 120, 150, 0.4)",
  accent: "#00d4aa",
  accentHover: "#00b894",
  text: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  button: {
    idle: "rgba(255, 255, 255, 0.85)",
    hover: "#00d4aa",
    active: "#00b894",
    disabled: "rgba(255, 255, 255, 0.4)",
  },
  progress: {
    bg: "rgba(100, 120, 150, 0.25)",
    fill: "linear-gradient(90deg, #00d4aa 0%, #00b894 100%)",
  },
  shadow: "0 8px 24px rgba(0, 0, 0, 0.3)", // Reduced shadow intensity
  glowShadow: "0 0 16px rgba(0, 212, 170, 0.2)", // Softer glow
};

// Music player state
let musicState = {
  isExpanded: true,
  lastKnownVolume: 0.7,
};

let initialized = false;
let statusSyncInterval = null;

// Playlist management
export const addToPlaylist = async (trackUrl, title = null) => {
  const track = {
    url: trackUrl,
    title: title || extractFilename(trackUrl),
    id: Date.now() + random(),
  };

  const success = addMusic(trackUrl);
  if (success) {
    updatePlaylistDisplay();
    return track.id;
  }
  return null;
};

export const removeFromPlaylist = (trackIndex) => {
  updatePlaylistDisplay();
};

export const clearPlaylist = () => {
  updatePlaylistDisplay();
};

// Helper functions
const extractFilename = (url) => {
  try {
    const filename = url.split("/").pop().split("?")[0];
    return filename.replace(/\.[^/.]+$/, "");
  } catch {
    return "Unknown Track";
  }
};

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const createElement = (tag, props = {}, children = []) => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  Object.assign(el.style, props.style || {});
  children.forEach((child) => {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  });
  return el;
};

// Control button creation
const createControlButton = (
  icon,
  title,
  onClick,
  size = MUSIC_CONFIG.controlSize
) => {
  return createElement("button", {
    innerHTML: icon,
    title,
    onclick: onClick,
    className: "music-control-btn",
    style: {
      width: `${size}px`,
      height: `${size}px`,
      fontSize: size === MUSIC_CONFIG.controlSize ? "16px" : "14px", // Reduced font sizes
      background: "rgba(255, 255, 255, 0.06)", // More subtle background
      backdropFilter: "blur(8px)", // Reduced blur
      border: "1px solid rgba(255, 255, 255, 0.12)", // Softer border
      borderRadius: "10px", // Slightly smaller radius
    },
  });
};

// Progress bar creation
const createProgressBar = (value = 0, max = 100, onChange = null) => {
  const container = createElement("div", {
    className: "progress-container",
    style: {
      flex: "1",
      height: "10px",
      background: MUSIC_THEME.progress.bg,
      borderRadius: "6px",
      position: "relative",
      cursor: "pointer",
      margin: "0 12px",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      overflow: "hidden",
    },
  });

  const fill = createElement("div", {
    className: "progress-fill",
    style: {
      height: "100%",
      background: MUSIC_THEME.progress.fill,
      borderRadius: "6px",
      width: `${max > 0 ? (value / max) * 100 : 0}%`,
      transition: "width 0.3s ease, box-shadow 0.2s ease",
      boxShadow: "0 0 12px rgba(0, 212, 170, 0.5)",
    },
  });

  container.addEventListener("mouseenter", () => {
    fill.style.boxShadow = "0 0 16px rgba(0, 212, 170, 0.7)";
  });

  container.addEventListener("mouseleave", () => {
    fill.style.boxShadow = "0 0 12px rgba(0, 212, 170, 0.5)";
  });

  container.appendChild(fill);

  if (onChange) {
    container.addEventListener("click", (e) => {
      const rect = container.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newValue = percent * (container.maxValue || max);
      onChange(newValue);
    });
  }

  container.updateValue = (newValue, newMax = null) => {
    if (newMax !== null) {
      container.maxValue = newMax;
    }
    const currentMax = container.maxValue || max;
    const percentage = currentMax > 0 ? (newValue / currentMax) * 100 : 0;
    fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  };

  container.maxValue = max;
  return container;
};

const createVolumeSlider = () => {
  const slider = createElement("input", {
    type: "range",
    min: "0",
    max: "1",
    step: "0.05",
    value: getVolume().toString(),
    className: "volume-slider",
    style: {
      width: `${MUSIC_CONFIG.volumeSliderWidth}px`,
      cursor: "pointer",
      height: "6px", // Thinner slider
      borderRadius: "3px",
      background: "rgba(100, 120, 150, 0.25)",
      outline: "none",
      appearance: "none",
      flexShrink: 0, // Prevent shrinking
    },
  });

  slider.addEventListener("input", handleVolumeChange);
  return slider;
};

// Main music player creation - Improved layout
const createMusicPlayer = () => {
  const container = createElement("div", {
    id: "music-player-container",
    className: "game-ui-element",
    style: {
      width: `${MUSIC_CONFIG.width}px`,
      minHeight: `${MUSIC_CONFIG.height}px`,
      background: MUSIC_THEME.bg,
      border: `1px solid ${MUSIC_THEME.border}`,
      borderRadius: `${MUSIC_CONFIG.borderRadius}px`,
      padding: `${MUSIC_CONFIG.padding}px`,
      display: "flex",
      flexDirection: "column",
      gap: `${MUSIC_CONFIG.spacing}px`,
      pointerEvents: "auto",
      overflow: "hidden",
      transition: "all 0.3s ease", // Faster transition
      backdropFilter: "blur(16px)", // Reduced blur
      boxShadow: MUSIC_THEME.shadow,
      position: "relative",
      boxSizing: "border-box", // Ensure proper sizing
    },
  });

  // Softer hover effects
  container.addEventListener("mouseenter", () => {
    container.style.boxShadow = `${MUSIC_THEME.shadow}, ${MUSIC_THEME.glowShadow}`;
  });

  container.addEventListener("mouseleave", () => {
    container.style.boxShadow = MUSIC_THEME.shadow;
  });

  // Top row - main controls with better spacing
  const topRow = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: `${MUSIC_CONFIG.spacing}px`,
      marginBottom: "6px", // Reduced margin
    },
  });

  // Simplified control buttons - Remove audio toggle and stop for cleaner look
  const prevBtn = createControlButton(
    "⏮",
    "Previous",
    handlePrevious,
    MUSIC_CONFIG.smallControlSize
  );
  prevBtn.id = "music-prev-btn";

  const playBtn = createControlButton("▶️", "Play", handlePlayPause);
  playBtn.id = "music-play-btn";
  playBtn.style.background = "rgba(0, 212, 170, 0.12)"; // More subtle accent
  playBtn.style.border = "1px solid rgba(0, 212, 170, 0.3)";

  const nextBtn = createControlButton(
    "⏭",
    "Next",
    handleNext,
    MUSIC_CONFIG.smallControlSize
  );
  nextBtn.id = "music-next-btn";

  // Track info with better proportions
  const trackInfo = createElement("div", {
    style: {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
      marginLeft: `${MUSIC_CONFIG.spacing}px`,
      marginRight: `${MUSIC_CONFIG.spacing}px`, // Add right margin
    },
  });

  // Create scrolling title container
  const titleContainer = createElement("div", {
    id: "music-track-title-container",
    style: {
      overflow: "hidden",
      position: "relative",
      height: "16px", // Fixed height for consistent layout
    },
  });

  const trackTitle = createElement(
    "div",
    {
      id: "music-track-title",
      style: {
        fontSize: "13px", // Slightly smaller
        fontWeight: "500", // Less bold
        color: MUSIC_THEME.text,
        whiteSpace: "nowrap",
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
        transition: "transform 0.3s ease",
      },
    },
    ["No track selected"]
  );

  titleContainer.appendChild(trackTitle);

  const timeDisplay = createElement(
    "div",
    {
      id: "music-time-display",
      style: {
        fontSize: "11px",
        color: MUSIC_THEME.textSecondary,
        marginTop: "2px", // Reduced margin
        fontFamily: "monospace",
        letterSpacing: "0.3px",
      },
    },
    ["0:00 / 0:00"]
  );

  trackInfo.appendChild(titleContainer);
  trackInfo.appendChild(timeDisplay);

  // Simplified volume controls - More compact
  const volumeContainer = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px", // Reduced gap
      background: "rgba(255, 255, 255, 0.04)", // More subtle background
      padding: "8px 12px", // Reduced padding
      borderRadius: "10px", // Smaller radius
      border: "1px solid rgba(255, 255, 255, 0.08)", // Softer border
      backdropFilter: "blur(6px)",
      flexShrink: 0, // Prevent shrinking
    },
  });

  const muteBtn = createControlButton(
    "🔊",
    "Mute",
    handleMute,
    MUSIC_CONFIG.smallControlSize
  );
  muteBtn.id = "music-mute-btn";

  const volumeSlider = createVolumeSlider();
  volumeSlider.id = "music-volume-slider";

  volumeContainer.appendChild(muteBtn);
  volumeContainer.appendChild(volumeSlider);

  const expandBtn = createControlButton(
    "🔽",
    "Collapse",
    handleExpand,
    MUSIC_CONFIG.smallControlSize
  );
  expandBtn.id = "music-expand-btn";

  // Assemble top row - Remove clutter
  topRow.appendChild(prevBtn);
  topRow.appendChild(playBtn);
  topRow.appendChild(nextBtn);
  topRow.appendChild(trackInfo);
  topRow.appendChild(volumeContainer);
  topRow.appendChild(expandBtn);

  // Progress bar row with better spacing
  const progressRow = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginTop: "2px", // Reduced margin
    },
  });

  const progressBar = createProgressBar(
    0,
    getDuration() || 100,
    handleProgressChange
  );
  progressBar.id = "music-progress-bar";
  progressBar.maxValue = getDuration() || 100;
  progressRow.appendChild(progressBar);

  // Playlist container with cleaner styling
  const playlist = createElement("div", {
    id: "music-playlist",
    style: {
      display: "block",
      maxHeight: "180px", // Reduced height
      overflowY: "auto",
      background: "rgba(255, 255, 255, 0.025)", // More subtle background
      border: `1px solid rgba(255, 255, 255, 0.08)`,
      borderRadius: "10px", // Smaller radius
      marginTop: "8px", // Reduced margin
      backdropFilter: "blur(8px)",
    },
  });

  container.appendChild(topRow);
  container.appendChild(progressRow);
  container.appendChild(playlist);

  return container;
};

// Status synchronization
const syncWithAudioSystem = () => {
  const audioPlaying = isMusicPlaying();
  const currentVolume = getVolume();
  const currentPosition = getCurrentPosition();
  const duration = getDuration();
  const currentTrackIndex = getCurrentTrackIndex();

  // Always update in this order to ensure proper synchronization
  updatePlayButton(audioPlaying);
  updateVolumeSlider(currentVolume); // This will also update mute button
  updateTimeDisplay(currentPosition, duration);
  updateTrackDisplay(currentTrackIndex);
  updatePlaylistDisplay(currentTrackIndex);
};

const startStatusSync = () => {
  if (!statusSyncInterval) {
    statusSyncInterval = setInterval(syncWithAudioSystem, 100);
  }
};

const stopStatusSync = () => {
  if (statusSyncInterval) {
    clearInterval(statusSyncInterval);
    statusSyncInterval = null;
  }
};

// Event handlers - Flattened conditionals
const handlePlayPause = async () => {
  const playlist = getPlaylist();
  if (!playlist.length) return;

  if (!hasUserInteracted()) setUserInteracted(true);

  const isPlaying = isMusicPlaying();
  const currentIndex = getCurrentTrackIndex();

  if (isPlaying) {
    pauseMusic();
    return;
  }

  if (currentIndex >= playlist.length) {
    await loadAndPlayTrack(0);
    return;
  }

  const resumed = await playMusic();
  if (!resumed) {
    await loadAndPlayTrack(currentIndex);
  }
};

const handleStop = () => stopMusic(true);

const handlePrevious = async () => {
  if (!hasUserInteracted()) setUserInteracted(true);
  await playPreviousTrack();
};

const handleNext = async () => {
  if (!hasUserInteracted()) setUserInteracted(true);
  await playNextTrack();
};

const handleAudioToggle = async () => {
  if (!hasUserInteracted()) setUserInteracted(true);

  const newState = await toggleAudio();

  if (newState) {
    const playlist = getPlaylist();
    if (playlist.length > 0 && !isMusicPlaying()) {
      await loadAndPlayTrack(0);
    }
  }
};

const handleMute = () => {
  const currentVolume = getVolume();

  if (currentVolume === 0) {
    // Unmute: restore previous volume
    const newVolume = musicState.lastKnownVolume || 0.7;
    setVolume(newVolume);
  } else {
    // Mute: save current volume and set to 0
    musicState.lastKnownVolume = currentVolume;
    setVolume(0);
  }

  // Immediately update the mute button and volume slider
  updateMuteButton();
  updateVolumeSlider();
};

const handleVolumeChange = (e) => {
  const newVolume = parseFloat(e.target.value);
  setVolume(newVolume);

  // Save non-zero volume as last known volume
  if (newVolume > 0) {
    musicState.lastKnownVolume = newVolume;
  }

  // Update mute button immediately
  updateMuteButton();
};

const handleProgressChange = async (newTime) => {
  if (!hasUserInteracted()) setUserInteracted(true);

  const success = await seekTo(newTime);
  if (success) {
    updateTimeDisplay(newTime, getDuration());
  }
};

const handleExpand = () => {
  musicState.isExpanded = !musicState.isExpanded;
  updateExpandButton();
  updatePlayerLayout();
};

// Update functions - Simplified
const updatePlayButton = (isPlaying = null) => {
  const playBtn = document.getElementById("music-play-btn");
  if (!playBtn) return;

  const playing = isPlaying !== null ? isPlaying : isMusicPlaying();
  playBtn.innerHTML = playing ? "⏸️" : "▶️";
  playBtn.title = playing ? "Pause" : "Play";

  // Control title scrolling based on play state
  const trackTitle = document.getElementById("music-track-title");
  if (trackTitle) {
    if (playing) {
      trackTitle.classList.remove("music-title-paused");
      trackTitle.classList.add("music-title-scrolling");
    } else {
      trackTitle.classList.add("music-title-paused");
      trackTitle.style.transform = "translateX(0)"; // Reset to start position
    }
  }
};

const updateMuteButton = () => {
  const muteBtn = document.getElementById("music-mute-btn");
  if (!muteBtn) return;

  const volume = getVolume();

  // Use different icons based on volume level
  if (volume === 0) {
    muteBtn.innerHTML = "🔇"; // Muted icon
    muteBtn.title = "Unmute";
    muteBtn.style.color = MUSIC_THEME.textSecondary; // Dimmed when muted
  } else if (volume < 0.5) {
    muteBtn.innerHTML = "🔉"; // Low volume icon
    muteBtn.title = "Mute";
    muteBtn.style.color = MUSIC_THEME.button.idle;
  } else {
    muteBtn.innerHTML = "🔊"; // High volume icon
    muteBtn.title = "Mute";
    muteBtn.style.color = MUSIC_THEME.button.idle;
  }
};

const updateVolumeSlider = (volume = null) => {
  const volumeSlider = document.getElementById("music-volume-slider");
  if (!volumeSlider) return;

  const currentVolume = volume !== null ? volume : getVolume();
  volumeSlider.value = currentVolume.toString();
  volumeSlider.style.opacity = currentVolume === 0 ? "0.6" : "1";

  // Also update mute button when volume slider is updated
  updateMuteButton();
};

const updateTrackDisplay = (trackIndex = null) => {
  const trackTitle = document.getElementById("music-track-title");
  const titleContainer = document.getElementById("music-track-title-container");
  if (!trackTitle || !titleContainer) return;

  const playlist = getPlaylist();
  const currentIndex =
    trackIndex !== null ? trackIndex : getCurrentTrackIndex();
  const currentTrack = playlist[currentIndex];

  const trackName = currentTrack
    ? extractFilename(currentTrack)
    : "No track selected";
  trackTitle.textContent = trackName;

  // Reset scrolling animation
  trackTitle.classList.remove("music-title-scrolling", "music-title-paused");
  trackTitle.style.animation = "none";
  trackTitle.style.transform = "translateX(0)";

  // Check if title needs scrolling (is wider than container)
  setTimeout(() => {
    const containerWidth = titleContainer.offsetWidth;
    const titleWidth = trackTitle.scrollWidth;

    if (titleWidth > containerWidth && currentTrack) {
      const scrollDistance = titleWidth - containerWidth + 20; // Add some padding
      trackTitle.style.setProperty("--scroll-distance", `-${scrollDistance}px`);

      // Apply scrolling animation if music is playing
      if (isMusicPlaying()) {
        trackTitle.classList.add("music-title-scrolling");
      } else {
        trackTitle.classList.add("music-title-paused");
      }
    }
  }, 100);
};

const updateTimeDisplay = (position = null, duration = null) => {
  const timeDisplay = document.getElementById("music-time-display");
  const progressBar = document.getElementById("music-progress-bar");

  const currentPos = position !== null ? position : getCurrentPosition();
  const totalDuration = duration !== null ? duration : getDuration();

  // Update time display
  if (timeDisplay) {
    timeDisplay.textContent = `${formatTime(currentPos)} / ${formatTime(
      totalDuration
    )}`;
  }

  // Update progress bar with proper synchronization
  if (progressBar?.updateValue) {
    // Only update if we have valid duration
    if (totalDuration > 0) {
      // Update the max value if duration changed
      if (progressBar.maxValue !== totalDuration) {
        progressBar.maxValue = totalDuration;
      }

      // Update the current position
      progressBar.updateValue(currentPos, totalDuration);
    } else {
      // No duration available, reset progress bar
      progressBar.updateValue(0, 100);
    }
  }
};

const updateExpandButton = () => {
  const expandBtn = document.getElementById("music-expand-btn");
  if (!expandBtn) return;

  expandBtn.innerHTML = musicState.isExpanded ? "🔽" : "🔼";
  expandBtn.title = musicState.isExpanded ? "Collapse" : "Expand";
};

const updatePlayerLayout = () => {
  const container = document.getElementById("music-player-container");
  const playlist = document.getElementById("music-playlist");

  if (!container || !playlist) return;

  if (musicState.isExpanded) {
    container.style.height = "auto";
    container.style.maxHeight = "320px";
    playlist.style.display = "block";
  } else {
    container.style.height = `${MUSIC_CONFIG.height}px`;
    playlist.style.display = "none";
  }
};

const updatePlaylistDisplay = (currentTrackIndex = null) => {
  const playlistContainer = document.getElementById("music-playlist");
  if (!playlistContainer) return;

  playlistContainer.innerHTML = "";

  const playlist = getPlaylist();
  const activeIndex =
    currentTrackIndex !== null ? currentTrackIndex : getCurrentTrackIndex();

  if (playlist.length === 0) {
    const emptyMsg = createElement(
      "div",
      {
        className: "playlist-empty",
        style: {
          padding: "12px",
          textAlign: "center",
          color: MUSIC_THEME.textSecondary,
          fontSize: "13px",
          fontStyle: "italic",
        },
      },
      ["No tracks in playlist"]
    );
    playlistContainer.appendChild(emptyMsg);
    return;
  }

  playlist.forEach((trackUrl, index) => {
    const isActive = index === activeIndex;
    const trackTitle = extractFilename(trackUrl);

    const trackItem = createElement("div", {
      className: "playlist-item",
      style: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        backgroundColor: isActive ? "rgba(0, 212, 170, 0.15)" : "transparent",
        color: isActive ? MUSIC_THEME.accent : MUSIC_THEME.text,
        cursor: "pointer",
        fontSize: "13px",
        borderRadius: "8px",
        margin: "2px 4px",
      },
      onclick: () => selectTrack(index),
    });

    const trackTitleEl = createElement(
      "span",
      {
        style: {
          flex: "1",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      [trackTitle]
    );

    const removeBtn = createElement("button", {
      innerHTML: "✕",
      title: "Remove from playlist",
      className: "playlist-remove-btn",
      onclick: (e) => {
        e.stopPropagation();
        removeFromPlaylist(index);
      },
      style: {
        background: "none",
        border: "none",
        color: MUSIC_THEME.textSecondary,
        cursor: "pointer",
        fontSize: "12px",
        padding: "4px 6px",
        marginLeft: "8px",
        borderRadius: "4px",
      },
    });

    trackItem.appendChild(trackTitleEl);
    trackItem.appendChild(removeBtn);
    playlistContainer.appendChild(trackItem);
  });
};

const selectTrack = async (index) => {
  if (!hasUserInteracted()) setUserInteracted(true);
  await loadAndPlayTrack(index);
};

// Improved styles with cleaner aesthetics
const createMusicPlayerStyles = () => {
  if (document.getElementById("music-player-styles")) return;

  const style = createElement("style", {
    id: "music-player-styles",
    textContent: `
      .music-control-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: ${MUSIC_THEME.button.idle};
        transition: all 0.2s ease;
        flex-shrink: 0;
        backdrop-filter: blur(8px);
      }

      .music-control-btn:hover {
        color: ${MUSIC_THEME.button.hover};
        background: rgba(0, 212, 170, 0.12);
        border-color: rgba(0, 212, 170, 0.3);
        box-shadow: 0 2px 8px rgba(0, 212, 170, 0.2);
        transform: translateY(-0.5px);
      }

      .music-control-btn:active {
        color: ${MUSIC_THEME.button.active};
        transform: translateY(0);
      }

      .volume-slider {
        -webkit-appearance: none;
        appearance: none;
        background: rgba(100, 120, 150, 0.25);
        outline: none;
        border-radius: 3px;
        transition: all 0.2s ease;
      }

      .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${MUSIC_THEME.accent};
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 212, 170, 0.4);
        transition: all 0.2s ease;
      }

      .volume-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 2px 8px rgba(0, 212, 170, 0.6);
        transform: scale(1.05);
      }

      .volume-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${MUSIC_THEME.accent};
        cursor: pointer;
        border: none;
        box-shadow: 0 1px 4px rgba(0, 212, 170, 0.4);
      }

      .playlist-item {
        transition: all 0.2s ease;
        border-radius: 6px;
      }

      .playlist-item:hover {
        background: rgba(0, 212, 170, 0.08) !important;
        transform: translateX(2px);
      }

      .playlist-remove-btn {
        transition: all 0.2s ease;
        border-radius: 50%;
      }

      .playlist-remove-btn:hover {
        color: ${MUSIC_THEME.accent} !important;
        background: rgba(0, 212, 170, 0.12);
        transform: scale(1.05);
      }

      #music-playlist::-webkit-scrollbar {
        width: 6px;
      }

      #music-playlist::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 3px;
      }

      #music-playlist::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, ${MUSIC_THEME.accent}, ${MUSIC_THEME.accentHover});
        border-radius: 3px;
        transition: all 0.2s ease;
      }

      #music-playlist::-webkit-scrollbar-thumb:hover {
        background: ${MUSIC_THEME.accent};
        box-shadow: 0 0 4px rgba(0, 212, 170, 0.3);
      }

      /* Scrolling title animation */
      @keyframes scrollTitle {
        0% {
          transform: translateX(0);
        }
        25% {
          transform: translateX(0);
        }
        75% {
          transform: translateX(var(--scroll-distance));
        }
        100% {
          transform: translateX(var(--scroll-distance));
        }
      }

      .music-title-scrolling {
        animation: scrollTitle 8s ease-in-out infinite;
      }

      .music-title-paused {
        animation-play-state: paused;
      }

      #music-track-title-container:hover #music-track-title {
        animation-play-state: paused;
      }
    `,
  });

  document.head.appendChild(style);
};

const updateAudioToggleButton = () => {
  const audioToggleBtn = document.getElementById("music-audio-toggle-btn");
  if (!audioToggleBtn) return;

  const enabled = isAudioEnabled();
  audioToggleBtn.innerHTML = enabled ? "🔊" : "🔇";
  audioToggleBtn.title = enabled ? "Disable Audio" : "Enable Audio";
};

export const initMusicPlayer = (container, initialPlaylist = []) => {
  if (!container) {
    console.error("Music player init failed: no container");
    return null;
  }

  initAudio();

  if (!initialized && initialPlaylist?.length > 0) {
    for (const track of initialPlaylist) {
      const trackUrl = typeof track === "string" ? track : track.url;
      if (trackUrl) addMusic(trackUrl);
    }
  }

  musicState.lastKnownVolume = getVolume() || 0.7;

  const musicPlayer = createMusicPlayer();
  container.appendChild(musicPlayer);
  createMusicPlayerStyles();

  // Position music player at bottom center
  Object.assign(musicPlayer.style, {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "1000",
  });

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  // Initial updates
  updatePlaylistDisplay();
  updateTrackDisplay();
  updateMuteButton();
  updateVolumeSlider();
  updateExpandButton();
  updateAudioToggleButton();

  startStatusSync();

  if (isAudioEnabled() && getPlaylist().length > 0) {
    console.log("Music player ready with", getPlaylist().length, "tracks");
  }

  initialized = true;

  return () => {
    stopStatusSync();
    musicPlayer.remove();
    const styles = document.getElementById("music-player-styles");
    if (styles) styles.remove();
  };
};

export const syncMusicPlayer = () => {
  syncWithAudioSystem();
  updateAudioToggleButton();
};

export const startPlayback = async () => {
  if (!hasUserInteracted()) setUserInteracted(true);

  if (!isAudioEnabled()) await toggleAudio();

  const playlist = getPlaylist();
  if (playlist.length > 0 && !isMusicPlaying()) {
    await loadAndPlayTrack(0);
  }
};

export const getMusicState = () => ({
  ...musicState,
  playlist: getPlaylist(),
  currentTrackIndex: getCurrentTrackIndex(),
  isPlaying: isMusicPlaying(),
  isAudioEnabled: isAudioEnabled(),
  volume: getVolume(),
  currentTime: getCurrentPosition(),
  duration: getDuration(),
});

export const getCurrentTrack = () => {
  const playlist = getPlaylist();
  const index = getCurrentTrackIndex();
  return playlist[index] || null;
};
