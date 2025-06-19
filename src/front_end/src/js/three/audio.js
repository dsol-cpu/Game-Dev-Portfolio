import { random } from "../utils/random";

const MAX_PLAYLIST_LENGTH = 25;

let audio = {
  context: null,
  enabled: true,
  volume: 0.5,
  initialized: false,
  userInteracted: false,

  musicGain: null,
  sfxGain: null,

  music: {
    source: null,
    buffer: null,
    playing: false,
    startTime: 0,
    pausedAt: 0,
    playlist: [],
    currentIndex: 0,
  },

  sfx: new Map(),

  visibility: {
    isVisible: true,
    wasPlayingBeforeHidden: false,
  },
};

// Utility functions
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isReady = () =>
  audio.context &&
  audio.enabled &&
  audio.userInteracted &&
  audio.visibility.isVisible;

async function waitForUserInteraction() {
  if (audio.userInteracted) return;

  return new Promise((resolve) => {
    const handleInteraction = () => {
      audio.userInteracted = true;
      ["click", "keydown", "touchstart"].forEach((event) =>
        document.removeEventListener(event, handleInteraction)
      );
      resolve();
    };

    ["click", "keydown", "touchstart"].forEach((event) =>
      document.addEventListener(event, handleInteraction)
    );
  });
}

async function resumeContext() {
  if (audio.context?.state === "suspended") {
    try {
      await audio.context.resume();
    } catch (error) {
      console.warn("Failed to resume audio context:", error);
    }
  }
}

function setGainValue(gainNode, value, immediate = false, time = 0.1) {
  if (!gainNode || !audio.context) return;

  const currentTime = audio.context.currentTime;
  if (immediate) {
    gainNode.gain.setValueAtTime(value, currentTime);
  } else {
    gainNode.gain.setTargetAtTime(value, currentTime, time);
  }
}

function stopSource(source) {
  if (!source) return;
  try {
    source.stop();
    source.disconnect();
  } catch (e) {
    // Source might already be stopped
  }
}

function handleDocumentVisibilityChange() {
  const wasVisible = audio.visibility.isVisible;
  audio.visibility.isVisible = !document.hidden;

  if (!wasVisible && audio.visibility.isVisible) {
    // Page became visible
    if (audio.visibility.wasPlayingBeforeHidden && isReady()) {
      resumeContext().then(() => {
        if (!audio.music.playing) {
          playMusic(audio.music.pausedAt, true);
        }
      });
    }
  } else if (wasVisible && !audio.visibility.isVisible) {
    // Page became hidden
    audio.visibility.wasPlayingBeforeHidden = audio.music.playing;
    if (audio.music.playing) {
      pauseMusic(true);
    }
  }
}

// Main API functions
export async function initAudio(initialMusicUrl = null) {
  if (audio.initialized) return audio;

  try {
    audio.context = new (window.AudioContext || window.webkitAudioContext)();

    // Create gain nodes
    audio.musicGain = audio.context.createGain();
    audio.sfxGain = audio.context.createGain();

    // Connect to destination
    audio.musicGain.connect(audio.context.destination);
    audio.sfxGain.connect(audio.context.destination);

    // Set initial volume
    setGainValue(audio.musicGain, audio.volume, true);
    setGainValue(audio.sfxGain, audio.volume, true);

    audio.initialized = true;
    document.addEventListener(
      "visibilitychange",
      handleDocumentVisibilityChange
    );

    if (initialMusicUrl) {
      await loadMusic(initialMusicUrl, false);
    }

    return audio;
  } catch (error) {
    console.error("Audio initialization failed:", error);
    return audio;
  }
}

export function addMusic(musicUrl) {
  if (audio.music.playlist.length >= MAX_PLAYLIST_LENGTH) return false;
  audio.music.playlist.push(musicUrl);
  return true;
}

export function addSFX(name, sfxUrl) {
  audio.sfx.set(name, sfxUrl);
  return true;
}

export async function loadMusic(musicUrl, autoPlay = false) {
  if (!audio.context) return false;

  try {
    const response = await fetch(musicUrl);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audio.context.decodeAudioData(arrayBuffer);

    audio.music.buffer = buffer;
    audio.music.pausedAt = 0;

    if (autoPlay && isReady()) {
      await resumeContext();
      playMusic();
    }
    return true;
  } catch (error) {
    console.error("Error loading music:", error);
    return false;
  }
}

export async function loadSFX(name) {
  if (!audio.context || !audio.sfx.has(name)) return false;

  const sfxUrl = audio.sfx.get(name);
  if (sfxUrl instanceof AudioBuffer) return true; // Already loaded

  try {
    const response = await fetch(sfxUrl);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audio.context.decodeAudioData(arrayBuffer);
    audio.sfx.set(name, buffer);
    return true;
  } catch (error) {
    console.error(`Error loading SFX ${name}:`, error);
    return false;
  }
}

export async function playSFX(name, volume = 1) {
  if (!isReady() || !audio.sfx.has(name)) return false;

  if (!audio.userInteracted) await waitForUserInteraction();
  await resumeContext();

  let buffer = audio.sfx.get(name);

  if (!(buffer instanceof AudioBuffer)) {
    await loadSFX(name);
    buffer = audio.sfx.get(name);
    if (!(buffer instanceof AudioBuffer)) return false;
  }

  const source = audio.context.createBufferSource();
  const gain = audio.context.createGain();

  source.buffer = buffer;
  gain.gain.value = audio.volume * volume;

  source.connect(gain);
  gain.connect(audio.sfxGain);
  source.start(0);

  return true;
}

export async function playMusic(resumeFromPosition = 0, immediate = false) {
  if (
    !audio.visibility.isVisible ||
    !audio.context ||
    !audio.music.buffer ||
    audio.music.playing ||
    !audio.enabled
  ) {
    return false;
  }

  if (!audio.userInteracted) await waitForUserInteraction();
  await resumeContext();

  // Stop existing source
  if (audio.music.source) {
    stopSource(audio.music.source);
    audio.music.source = null;
  }

  const source = audio.context.createBufferSource();
  source.buffer = audio.music.buffer;
  source.loop = true;
  source.connect(audio.musicGain);

  const startPosition = resumeFromPosition || audio.music.pausedAt;

  // Handle volume fade
  setGainValue(audio.musicGain, immediate ? audio.volume : 0, true);
  if (!immediate) {
    setGainValue(audio.musicGain, audio.volume, false, 1);
  }

  source.start(0, startPosition);

  // Handle track ending
  source.addEventListener("ended", () => {
    if (audio.music.source === source) {
      audio.music.playing = false;
      audio.music.source = null;
      playNextTrack();
    }
  });

  audio.music.source = source;
  audio.music.startTime = audio.context.currentTime - startPosition;
  audio.music.playing = true;

  return true;
}

export function pauseMusic(immediate = false) {
  if (!audio.music.source || !audio.music.playing) return false;

  // Store position
  if (audio.context && audio.music.buffer) {
    const elapsed = audio.context.currentTime - audio.music.startTime;
    audio.music.pausedAt = elapsed % audio.music.buffer.duration;
  }

  audio.music.playing = false;

  if (immediate) {
    stopSource(audio.music.source);
    audio.music.source = null;
  } else {
    setGainValue(audio.musicGain, 0, false, 0.5);
    const currentSource = audio.music.source;
    setTimeout(() => {
      if (currentSource === audio.music.source) {
        stopSource(currentSource);
        audio.music.source = null;
      }
    }, 500);
  }

  return true;
}

export function stopMusic(immediate = false) {
  if (!audio.music.source) return false;

  audio.music.pausedAt = 0;
  audio.music.playing = false;

  if (immediate) {
    stopSource(audio.music.source);
    audio.music.source = null;
  } else {
    setGainValue(audio.musicGain, 0, false, 0.5);
    const currentSource = audio.music.source;
    setTimeout(() => {
      if (currentSource === audio.music.source) {
        stopSource(currentSource);
        audio.music.source = null;
      }
    }, 500);
  }

  return true;
}

export async function toggleAudio(immediate = false) {
  audio.enabled = !audio.enabled;

  if (audio.enabled) {
    if (!audio.initialized) {
      await initAudio();
      return audio.enabled;
    }

    if (!audio.userInteracted) await waitForUserInteraction();
    await resumeContext();

    // Update gain nodes
    setGainValue(audio.musicGain, audio.volume, immediate, 0.1);
    setGainValue(audio.sfxGain, audio.volume, immediate, 0.1);
  } else if (audio.music.playing) {
    pauseMusic(immediate);
  }

  return audio.enabled;
}

export function setVolume(volume, immediate = false) {
  audio.volume = clamp(volume, 0, 1);

  if (audio.initialized && audio.enabled) {
    setGainValue(audio.musicGain, audio.volume, immediate, 0.1);
    setGainValue(audio.sfxGain, audio.volume, immediate, 0.1);
  }

  return audio.volume;
}

// Simple getters
export const getVolume = () => audio.volume;
export const isAudioEnabled = () => audio.enabled;
export const isMusicPlaying = () => audio.music.playing;
export const hasUserInteracted = () => audio.userInteracted;
export const getPlaylist = () => [...audio.music.playlist];
export const getCurrentTrackIndex = () => audio.music.currentIndex;

export function setUserInteracted(interacted) {
  audio.userInteracted = interacted;
}

export function setCurrentTrackIndex(index) {
  if (index >= 0 && index < audio.music.playlist.length) {
    audio.music.currentIndex = index;
    return true;
  }
  return false;
}

export function getCurrentPosition() {
  if (!audio.context || !audio.music.buffer) {
    return audio.music.pausedAt || 0;
  }

  if (audio.music.playing && audio.music.source) {
    const elapsed = audio.context.currentTime - audio.music.startTime;
    return elapsed % audio.music.buffer.duration;
  }

  return audio.music.pausedAt || 0;
}

export const getDuration = () => audio.music.buffer?.duration || 0;

export async function seekTo(position) {
  if (
    !audio.music.buffer ||
    position < 0 ||
    position > audio.music.buffer.duration
  ) {
    return false;
  }

  const wasPlaying = audio.music.playing;
  audio.music.pausedAt = position;

  if (wasPlaying) {
    pauseMusic(true);
    await playMusic(position, true);
  }

  return true;
}

export async function loadAndPlayTrack(index) {
  if (index < 0 || index >= audio.music.playlist.length) return false;

  if (audio.music.playing) stopMusic(true);

  audio.music.currentIndex = index;
  const trackUrl = audio.music.playlist[index];

  const loaded = await loadMusic(trackUrl, false);
  if (!loaded) return false;

  if (isReady()) {
    await resumeContext();
    return await playMusic(0, true);
  }

  return true;
}

export async function playNextTrack() {
  const nextIndex =
    audio.music.currentIndex < audio.music.playlist.length - 1
      ? audio.music.currentIndex + 1
      : 0;
  return await loadAndPlayTrack(nextIndex);
}

export async function playPreviousTrack() {
  const prevIndex =
    audio.music.currentIndex > 0
      ? audio.music.currentIndex - 1
      : audio.music.playlist.length - 1;
  return await loadAndPlayTrack(prevIndex);
}

export function clearPlaylist() {
  if (audio.music.playing) stopMusic(true);

  audio.music.playlist = [];
  audio.music.currentIndex = 0;
  audio.music.buffer = null;

  return true;
}

export function removeFromPlaylist(index) {
  if (index < 0 || index >= audio.music.playlist.length) return false;

  const currentIndex = audio.music.currentIndex;

  if (index === currentIndex) {
    stopMusic(true);
    audio.music.buffer = null;
  }

  audio.music.playlist.splice(index, 1);

  if (index < currentIndex) {
    audio.music.currentIndex = currentIndex - 1;
  } else if (index === currentIndex && audio.music.playlist.length > 0) {
    audio.music.currentIndex = Math.min(
      currentIndex,
      audio.music.playlist.length - 1
    );
  } else if (audio.music.playlist.length === 0) {
    audio.music.currentIndex = 0;
  }

  return true;
}

export function shufflePlaylist() {
  if (audio.music.playlist.length <= 1) return false;

  const currentTrack = audio.music.playlist[audio.music.currentIndex];

  for (let i = audio.music.playlist.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [audio.music.playlist[i], audio.music.playlist[j]] = [
      audio.music.playlist[j],
      audio.music.playlist[i],
    ];
  }

  audio.music.currentIndex = audio.music.playlist.indexOf(currentTrack);
  return true;
}

export async function restoreAudioState(immediate = true) {
  if (!audio.initialized || !audio.visibility.isVisible) return false;

  if (audio.enabled) {
    if (!audio.userInteracted) await waitForUserInteraction();
    await resumeContext();

    if (!audio.music.playing && audio.music.buffer) {
      await playMusic(audio.music.pausedAt, immediate);
    }

    setGainValue(audio.musicGain, audio.volume, immediate, 0.1);
    setGainValue(audio.sfxGain, audio.volume, immediate, 0.1);
  }

  return true;
}

export function dispose() {
  document.removeEventListener(
    "visibilitychange",
    handleDocumentVisibilityChange
  );

  if (audio.music.source && audio.music.playing) {
    stopSource(audio.music.source);
  }

  audio.musicGain?.disconnect();
  audio.sfxGain?.disconnect();
  audio.context?.close();

  // Preserve settings
  const settings = {
    enabled: audio.enabled,
    volume: audio.volume,
    userInteracted: audio.userInteracted,
    currentIndex: audio.music.currentIndex,
    playlist: [...audio.music.playlist],
  };

  // Reset state
  Object.assign(audio, {
    context: null,
    initialized: false,
    musicGain: null,
    sfxGain: null,
    music: {
      source: null,
      buffer: null,
      playing: false,
      startTime: 0,
      pausedAt: 0,
      playlist: settings.playlist,
      currentIndex: settings.currentIndex,
    },
    sfx: new Map(),
    visibility: {
      isVisible: true,
      wasPlayingBeforeHidden: false,
    },
    ...settings,
  });

  return true;
}

// Public API compatibility - other scripts may call this
export async function handleVisibilityChange(isVisible, isGameView) {
  // Update our internal visibility state to match what external scripts expect
  const wasVisible = audio.visibility.isVisible;
  audio.visibility.isVisible = isVisible;

  if (!wasVisible && isVisible) {
    // Page/game became visible - restore audio if needed
    if (audio.visibility.wasPlayingBeforeHidden && isReady()) {
      await resumeContext();
      if (!audio.music.playing) {
        await playMusic(audio.music.pausedAt, true);
      }
    }
  } else if (wasVisible && !isVisible) {
    // Page/game became hidden - pause audio
    audio.visibility.wasPlayingBeforeHidden = audio.music.playing;
    if (audio.music.playing) {
      pauseMusic(true);
    }
  }

  return true;
}
