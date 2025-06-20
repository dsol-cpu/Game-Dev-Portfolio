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

// Consolidated config
const CONFIG = {
  width: 480,
  height: 80,
  padding: 20,
  spacing: 10,
  controlSize: 36,
  smallControlSize: 28,
  borderRadius: 16,
  volumeSliderWidth: 100,
  updateInterval: 250, // Reduced from 100ms
  theme: {
    bg: "linear-gradient(135deg, rgba(15, 20, 30, 0.95) 0%, rgba(25, 35, 50, 0.95) 100%)",
    border: "rgba(100, 120, 150, 0.4)",
    accent: "#00d4aa",
    text: "rgba(255, 255, 255, 0.95)",
    textSecondary: "rgba(255, 255, 255, 0.7)",
    buttonBg: "rgba(255, 255, 255, 0.06)",
    progressBg: "rgba(100, 120, 150, 0.25)",
    progressFill: "linear-gradient(90deg, #00d4aa 0%, #00b894 100%)",
    shadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
  },
};

// Consolidated state
const state = {
  isExpanded: true,
  lastKnownVolume: 0.7,
  initialized: false,
  syncInterval: null,
  elements: {}, // Cache DOM elements
  playerContainer: null, // Store reference to player container
  isVisible: true, // Track visibility state
  wasPlayingBeforeHide: false, // Remember playback state when hiding
  lastUpdate: {
    // Debounce updates
    position: 0,
    duration: 0,
    volume: 0,
    trackIndex: -1,
    isPlaying: false,
  },
};

// Optimized element creation with template literals for better performance
const createEl = (tag, props = {}, html = "") => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  if (props.style) Object.assign(el.style, props.style);
  if (html) el.innerHTML = html;
  return el;
};

// Unified button factory with shared styles
const createButton = (
  content,
  title,
  onClick,
  size = CONFIG.controlSize,
  extraStyles = {}
) => {
  return createEl("button", {
    innerHTML: content,
    title,
    onclick: onClick,
    className: "music-btn",
    style: {
      width: `${size}px`,
      height: `${size}px`,
      fontSize: size === CONFIG.controlSize ? "16px" : "14px",
      background: CONFIG.theme.buttonBg,
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: "10px",
      cursor: "pointer",
      color: CONFIG.theme.text,
      transition: "all 0.2s ease",
      ...extraStyles,
    },
  });
};

// Optimized progress bar with reduced DOM manipulation
const createProgressBar = (onChange) => {
  const container = createEl("div", {
    className: "progress-container",
    style: {
      flex: "1",
      height: "10px",
      background: CONFIG.theme.progressBg,
      borderRadius: "6px",
      position: "relative",
      cursor: "pointer",
      margin: "0 12px",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      overflow: "hidden",
    },
  });

  const fill = createEl("div", {
    className: "progress-fill",
    style: {
      height: "100%",
      background: CONFIG.theme.progressFill,
      borderRadius: "6px",
      width: "0%",
      transition: "width 0.1s linear", // Smoother, faster transition
      boxShadow: "0 0 12px rgba(0, 212, 170, 0.5)",
    },
  });

  container.appendChild(fill);

  // Throttled click handler
  let clickTimeout;
  container.onclick = (e) => {
    if (clickTimeout) return;
    clickTimeout = setTimeout(() => (clickTimeout = null), 100);

    const rect = container.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onChange(percent * (getDuration() || 100));
  };

  // Cached update function
  container.updateProgress = (value, max) => {
    const percentage =
      max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    fill.style.width = `${percentage}%`;
  };

  return container;
};

// Playlist management with batched updates
export const addToPlaylist = (trackUrl, title = null) => {
  const success = addMusic(trackUrl);
  if (success) {
    // Debounce playlist updates
    clearTimeout(state.playlistUpdateTimeout);
    state.playlistUpdateTimeout = setTimeout(updatePlaylist, 50);
  }
  return success;
};

// Optimized event handlers with early returns
const handlePlayPause = async () => {
  const playlist = getPlaylist();
  if (!playlist.length) return;

  if (!hasUserInteracted()) setUserInteracted(true);

  if (isMusicPlaying()) {
    pauseMusic();
  } else {
    const currentIndex = getCurrentTrackIndex();
    if (currentIndex >= playlist.length) {
      await loadAndPlayTrack(0);
    } else {
      const resumed = await playMusic();
      if (!resumed) await loadAndPlayTrack(currentIndex);
    }
  }
};

const handleVolume = (e) => {
  const newVolume = parseFloat(e.target.value);
  setVolume(newVolume);
  if (newVolume > 0) state.lastKnownVolume = newVolume;
  updateVolumeUI();
};

const handleMute = () => {
  const currentVolume = getVolume();
  if (currentVolume === 0) {
    setVolume(state.lastKnownVolume || 0.7);
  } else {
    state.lastKnownVolume = currentVolume;
    setVolume(0);
  }
  updateVolumeUI();
};

// Consolidated UI updates with change detection
const updateUI = () => {
  // Don't update UI if player is hidden
  if (!state.isVisible || !state.playerContainer) return;

  const current = {
    position: getCurrentPosition(),
    duration: getDuration(),
    volume: getVolume(),
    trackIndex: getCurrentTrackIndex(),
    isPlaying: isMusicPlaying(),
  };

  // Only update what changed
  if (current.isPlaying !== state.lastUpdate.isPlaying) {
    state.elements.playBtn.innerHTML = current.isPlaying ? "⏸️" : "▶️";
    state.elements.playBtn.title = current.isPlaying ? "Pause" : "Play";
    state.lastUpdate.isPlaying = current.isPlaying;
  }

  if (
    current.position !== state.lastUpdate.position ||
    current.duration !== state.lastUpdate.duration
  ) {
    state.elements.timeDisplay.textContent = `${formatTime(
      current.position
    )} / ${formatTime(current.duration)}`;
    state.elements.progressBar.updateProgress(
      current.position,
      current.duration
    );
    state.lastUpdate.position = current.position;
    state.lastUpdate.duration = current.duration;
  }

  if (current.volume !== state.lastUpdate.volume) {
    updateVolumeUI();
    state.lastUpdate.volume = current.volume;
  }

  if (current.trackIndex !== state.lastUpdate.trackIndex) {
    updateTrackInfo();
    state.lastUpdate.trackIndex = current.trackIndex;
  }
};

const updateVolumeUI = () => {
  const volume = getVolume();
  state.elements.volumeSlider.value = volume;
  state.elements.muteBtn.innerHTML =
    volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";
  state.elements.muteBtn.title = volume === 0 ? "Unmute" : "Mute";
};

const updateTrackInfo = () => {
  const playlist = getPlaylist();
  const currentIndex = getCurrentTrackIndex();
  const track = playlist[currentIndex];
  const title = track ? extractFilename(track) : "No track selected";
  state.elements.trackTitle.textContent = title;
};

const updatePlaylist = () => {
  const container = state.elements.playlist;
  if (!container) return;

  const playlist = getPlaylist();
  const activeIndex = getCurrentTrackIndex();

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  if (playlist.length === 0) {
    const empty = createEl(
      "div",
      {
        style: {
          padding: "12px",
          textAlign: "center",
          color: CONFIG.theme.textSecondary,
          fontSize: "13px",
          fontStyle: "italic",
        },
      },
      "No tracks in playlist"
    );
    fragment.appendChild(empty);
  } else {
    playlist.forEach((trackUrl, index) => {
      const isActive = index === activeIndex;
      const item = createEl("div", {
        className: "playlist-item",
        onclick: () => selectTrack(index),
        style: {
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          backgroundColor: isActive ? "rgba(0, 212, 170, 0.15)" : "transparent",
          color: isActive ? CONFIG.theme.accent : CONFIG.theme.text,
          cursor: "pointer",
          fontSize: "13px",
          borderRadius: "8px",
          margin: "2px 4px",
        },
      });

      const title = createEl(
        "span",
        {
          style: {
            flex: "1",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        extractFilename(trackUrl)
      );

      const removeBtn = createEl("button", {
        innerHTML: "✕",
        onclick: (e) => {
          e.stopPropagation();
          removeFromPlaylist(index);
        },
        style: {
          background: "none",
          border: "none",
          color: CONFIG.theme.textSecondary,
          cursor: "pointer",
          fontSize: "12px",
          padding: "4px 6px",
          marginLeft: "8px",
          borderRadius: "4px",
        },
      });

      item.appendChild(title);
      item.appendChild(removeBtn);
      fragment.appendChild(item);
    });
  }

  container.innerHTML = "";
  container.appendChild(fragment);
};

// Optimized helper functions
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const extractFilename = (url) => {
  try {
    return url
      .split("/")
      .pop()
      .split("?")[0]
      .replace(/\.[^/.]+$/, "");
  } catch {
    return "Unknown Track";
  }
};

const selectTrack = async (index) => {
  if (!hasUserInteracted()) setUserInteracted(true);
  await loadAndPlayTrack(index);
};

// Main player creation with cached elements
const createPlayer = () => {
  const container = createEl("div", {
    id: "music-player-container",
    className: "game-ui-element",
    style: {
      width: `${CONFIG.width}px`,
      minHeight: `${CONFIG.height}px`,
      background: CONFIG.theme.bg,
      border: `1px solid ${CONFIG.theme.border}`,
      borderRadius: `${CONFIG.borderRadius}px`,
      padding: `${CONFIG.padding}px`,
      display: "flex",
      flexDirection: "column",
      gap: `${CONFIG.spacing}px`,
      pointerEvents: "auto",
      overflow: "hidden",
      transition: "all 0.3s ease",
      backdropFilter: "blur(16px)",
      boxShadow: CONFIG.theme.shadow,
      position: "absolute",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "1000",
      boxSizing: "border-box",
    },
  });

  // Create and cache all elements
  const elements = {
    playBtn: createButton("▶️", "Play", handlePlayPause, CONFIG.controlSize, {
      background: "rgba(0, 212, 170, 0.12)",
      border: "1px solid rgba(0, 212, 170, 0.3)",
    }),
    prevBtn: createButton(
      "⏮",
      "Previous",
      () => playPreviousTrack(),
      CONFIG.smallControlSize
    ),
    nextBtn: createButton(
      "⏭",
      "Next",
      () => playNextTrack(),
      CONFIG.smallControlSize
    ),
    muteBtn: createButton("🔊", "Mute", handleMute, CONFIG.smallControlSize),
    expandBtn: createButton(
      "🔽",
      "Collapse",
      () => {
        state.isExpanded = !state.isExpanded;
        elements.expandBtn.innerHTML = state.isExpanded ? "🔽" : "🔼";
        elements.playlist.style.display = state.isExpanded ? "block" : "none";
        container.style.height = state.isExpanded
          ? "auto"
          : `${CONFIG.height}px`;
      },
      CONFIG.smallControlSize
    ),
    volumeSlider: createEl("input", {
      type: "range",
      min: "0",
      max: "1",
      step: "0.05",
      value: getVolume().toString(),
      oninput: handleVolume,
      style: {
        width: `${CONFIG.volumeSliderWidth}px`,
        cursor: "pointer",
        height: "6px",
        borderRadius: "3px",
        background: CONFIG.theme.progressBg,
        outline: "none",
        appearance: "none",
        flexShrink: 0,
      },
    }),
    trackTitle: createEl(
      "div",
      {
        style: {
          fontSize: "13px",
          fontWeight: "500",
          color: CONFIG.theme.text,
          whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
        },
      },
      "No track selected"
    ),
    timeDisplay: createEl(
      "div",
      {
        style: {
          fontSize: "11px",
          color: CONFIG.theme.textSecondary,
          marginTop: "2px",
          fontFamily: "monospace",
          letterSpacing: "0.3px",
        },
      },
      "0:00 / 0:00"
    ),
    progressBar: createProgressBar(async (time) => {
      if (!hasUserInteracted()) setUserInteracted(true);
      await seekTo(time);
    }),
    playlist: createEl("div", {
      style: {
        display: "block",
        maxHeight: "180px",
        overflowY: "auto",
        background: "rgba(255, 255, 255, 0.025)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        marginTop: "8px",
        backdropFilter: "blur(8px)",
      },
    }),
  };

  // Assembly with minimal DOM manipulation
  const topRow = createEl("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: `${CONFIG.spacing}px`,
      marginBottom: "6px",
    },
  });

  const trackInfo = createEl("div", {
    style: {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
      marginLeft: `${CONFIG.spacing}px`,
      marginRight: `${CONFIG.spacing}px`,
    },
  });

  const titleContainer = createEl("div", {
    style: { overflow: "hidden", position: "relative", height: "16px" },
  });

  const volumeContainer = createEl("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "rgba(255, 255, 255, 0.04)",
      padding: "8px 12px",
      borderRadius: "10px",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      backdropFilter: "blur(6px)",
      flexShrink: 0,
    },
  });

  const progressRow = createEl("div", {
    style: { display: "flex", alignItems: "center", marginTop: "2px" },
  });

  // Assemble DOM
  titleContainer.appendChild(elements.trackTitle);
  trackInfo.appendChild(titleContainer);
  trackInfo.appendChild(elements.timeDisplay);
  volumeContainer.appendChild(elements.muteBtn);
  volumeContainer.appendChild(elements.volumeSlider);
  progressRow.appendChild(elements.progressBar);

  topRow.appendChild(elements.prevBtn);
  topRow.appendChild(elements.playBtn);
  topRow.appendChild(elements.nextBtn);
  topRow.appendChild(trackInfo);
  topRow.appendChild(volumeContainer);
  topRow.appendChild(elements.expandBtn);

  container.appendChild(topRow);
  container.appendChild(progressRow);
  container.appendChild(elements.playlist);

  // Cache elements globally
  state.elements = elements;

  return container;
};

// NEW: Hide music player function
export const hideMusicPlayer = () => {
  if (!state.playerContainer || !state.isVisible) return;

  // Remember if music was playing when we hide
  state.wasPlayingBeforeHide = isMusicPlaying();

  // Pause music if playing
  if (state.wasPlayingBeforeHide) {
    pauseMusic();
  }

  // Hide the player
  state.playerContainer.style.display = "none";
  state.isVisible = false;

  console.log("Music player hidden, was playing:", state.wasPlayingBeforeHide);
};

// NEW: Show music player function
export const showMusicPlayer = () => {
  if (!state.playerContainer || state.isVisible) return;

  // Show the player
  state.playerContainer.style.display = "flex";
  state.isVisible = true;

  // Resume music if it was playing before hiding
  if (state.wasPlayingBeforeHide && hasUserInteracted()) {
    playMusic();
    state.wasPlayingBeforeHide = false; // Reset the flag
  }

  // Force UI update when showing
  updateUI();
  updatePlaylist();

  console.log("Music player shown");
};

// NEW: Check if music player is visible
export const isMusicPlayerVisible = () => {
  return (
    state.isVisible &&
    state.playerContainer &&
    state.playerContainer.style.display !== "none"
  );
};

// Optimized initialization
export const initMusicPlayer = (container, initialPlaylist = []) => {
  if (!container) return null;

  // If already initialized, just show it
  if (state.initialized && state.playerContainer) {
    // Re-attach to new container if different
    if (state.playerContainer.parentNode !== container) {
      container.appendChild(state.playerContainer);
    }
    showMusicPlayer();
    return () => hideMusicPlayer(); // Return hide function instead of dispose
  }

  initAudio();

  // Batch add initial playlist
  if (initialPlaylist?.length > 0) {
    initialPlaylist.forEach((track) => {
      const url = typeof track === "string" ? track : track.url;
      if (url) addMusic(url);
    });
  }

  state.lastKnownVolume = getVolume() || 0.7;

  const player = createPlayer();
  state.playerContainer = player; // Store reference
  container.appendChild(player);

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  // Initial UI sync
  updateUI();
  updatePlaylist();

  // Start optimized sync with reduced frequency
  if (!state.syncInterval) {
    state.syncInterval = setInterval(updateUI, CONFIG.updateInterval);
  }

  state.initialized = true;
  state.isVisible = true;

  // Return hide function instead of dispose function
  return () => hideMusicPlayer();
};

// NEW: Complete disposal function (only call when truly cleaning up)
export const disposeMusicPlayer = () => {
  if (state.syncInterval) {
    clearInterval(state.syncInterval);
    state.syncInterval = null;
  }

  if (state.playerContainer) {
    state.playerContainer.remove();
    state.playerContainer = null;
  }

  // Reset state
  state.initialized = false;
  state.isVisible = false;
  state.wasPlayingBeforeHide = false;
  state.elements = {};

  console.log("Music player completely disposed");
};

// Simplified exports
export const syncMusicPlayer = updateUI;
export const startPlayback = async () => {
  if (!hasUserInteracted()) setUserInteracted(true);
  if (!isAudioEnabled()) await toggleAudio();
  const playlist = getPlaylist();
  if (playlist.length > 0 && !isMusicPlaying()) await loadAndPlayTrack(0);
};

export const getMusicState = () => ({
  ...state,
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

export { removeFromPlaylist, clearPlaylist } from "./audio.js"; // Re-export if needed
