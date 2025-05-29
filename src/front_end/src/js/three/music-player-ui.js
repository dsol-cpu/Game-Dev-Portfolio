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
  shadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
  glowShadow: "0 0 16px rgba(0, 212, 170, 0.2)",
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
      fontSize: size === MUSIC_CONFIG.controlSize ? "16px" : "14px",
      background: "rgba(255, 255, 255, 0.06)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: "10px",
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
      height: "6px",
      borderRadius: "3px",
      background: "rgba(100, 120, 150, 0.25)",
      outline: "none",
      appearance: "none",
      flexShrink: 0,
    },
  });

  slider.addEventListener("input", handleVolumeChange);
  return slider;
};

// Main music player creation
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
      transition: "all 0.3s ease",
      backdropFilter: "blur(16px)",
      boxShadow: MUSIC_THEME.shadow,
      position: "relative",
      boxSizing: "border-box",
    },
  });

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
      marginBottom: "6px",
    },
  });

  // Control buttons
  const prevBtn = createControlButton(
    "⏮",
    "Previous",
    handlePrevious,
    MUSIC_CONFIG.smallControlSize
  );
  prevBtn.id = "music-prev-btn";

  const playBtn = createControlButton("", "Play", handlePlayPause);
  playBtn.id = "music-play-btn";
  playBtn.style.background = "rgba(0, 212, 170, 0.12)";
  playBtn.style.border = "1px solid rgba(0, 212, 170, 0.3)";

  const nextBtn = createControlButton(
    "⏭",
    "Next",
    handleNext,
    MUSIC_CONFIG.smallControlSize
  );
  nextBtn.id = "music-next-btn";

  // Track info
  const trackInfo = createElement("div", {
    style: {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
      marginLeft: `${MUSIC_CONFIG.spacing}px`,
      marginRight: `${MUSIC_CONFIG.spacing}px`,
    },
  });

  // Create scrolling title container
  const titleContainer = createElement("div", {
    id: "music-track-title-container",
    style: {
      overflow: "hidden",
      position: "relative",
      height: "16px",
    },
  });

  const trackTitle = createElement(
    "div",
    {
      id: "music-track-title",
      style: {
        fontSize: "13px",
        fontWeight: "500",
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
        marginTop: "2px",
        fontFamily: "monospace",
        letterSpacing: "0.3px",
      },
    },
    ["0:00 / 0:00"]
  );

  trackInfo.appendChild(titleContainer);
  trackInfo.appendChild(timeDisplay);

  // Volume controls
  const volumeContainer = createElement("div", {
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

  // Assemble top row
  topRow.appendChild(prevBtn);
  topRow.appendChild(playBtn);
  topRow.appendChild(nextBtn);
  topRow.appendChild(trackInfo);
  topRow.appendChild(volumeContainer);
  topRow.appendChild(expandBtn);

  // Progress bar row
  const progressRow = createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginTop: "2px",
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

  // Playlist container
  const playlist = createElement("div", {
    id: "music-playlist",
    style: {
      display: "block",
      maxHeight: "180px",
      overflowY: "auto",
      background: "rgba(255, 255, 255, 0.025)",
      border: `1px solid rgba(255, 255, 255, 0.08)`,
      borderRadius: "10px",
      marginTop: "8px",
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

  updatePlayButton(audioPlaying);
  updateVolumeSlider(currentVolume);
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

// Event handlers
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
    const newVolume = musicState.lastKnownVolume || 0.7;
    setVolume(newVolume);
  } else {
    musicState.lastKnownVolume = currentVolume;
    setVolume(0);
  }

  updateMuteButton();
  updateVolumeSlider();
};

const handleVolumeChange = (e) => {
  const newVolume = parseFloat(e.target.value);
  setVolume(newVolume);

  if (newVolume > 0) {
    musicState.lastKnownVolume = newVolume;
  }

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

// Update functions
const updatePlayButton = (isPlaying = null) => {
  const playBtn = document.getElementById("music-play-btn");
  if (!playBtn) return;

  const playing = isPlaying !== null ? isPlaying : isMusicPlaying();
  playBtn.innerHTML = playing ? "⏸️" : "▶️";
  playBtn.title = playing ? "Pause" : "Play";

  const trackTitle = document.getElementById("music-track-title");
  if (trackTitle) {
    if (playing) {
      trackTitle.classList.remove("music-title-paused");
      trackTitle.classList.add("music-title-scrolling");
    } else {
      trackTitle.classList.add("music-title-paused");
      trackTitle.style.transform = "translateX(0)";
    }
  }
};

const updateMuteButton = () => {
  const muteBtn = document.getElementById("music-mute-btn");
  if (!muteBtn) return;

  const volume = getVolume();

  if (volume === 0) {
    muteBtn.innerHTML = "🔇";
    muteBtn.title = "Unmute";
    muteBtn.style.color = MUSIC_THEME.textSecondary;
  } else if (volume < 0.5) {
    muteBtn.innerHTML = "🔉";
    muteBtn.title = "Mute";
    muteBtn.style.color = MUSIC_THEME.button.idle;
  } else {
    muteBtn.innerHTML = "🔊";
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

  trackTitle.classList.remove("music-title-scrolling", "music-title-paused");
  trackTitle.style.animation = "none";
  trackTitle.style.transform = "translateX(0)";

  setTimeout(() => {
    const containerWidth = titleContainer.offsetWidth;
    const titleWidth = trackTitle.scrollWidth;

    if (titleWidth > containerWidth && currentTrack) {
      const scrollDistance = titleWidth - containerWidth + 20;
      trackTitle.style.setProperty("--scroll-distance", `-${scrollDistance}px`);

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

  if (timeDisplay) {
    timeDisplay.textContent = `${formatTime(currentPos)} / ${formatTime(
      totalDuration
    )}`;
  }

  if (progressBar?.updateValue) {
    if (totalDuration > 0) {
      if (progressBar.maxValue !== totalDuration) {
        progressBar.maxValue = totalDuration;
      }
      progressBar.updateValue(currentPos, totalDuration);
    } else {
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
