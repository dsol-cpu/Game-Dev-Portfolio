import { random } from "../utils/random";

const MAX_PLAYLIST_LENGTH = 25;

let audioState = {
  // Core audio system
  context: null,
  enabled: true,
  volume: 0.7,
  initialized: false,
  userInteracted: false,

  // Music properties
  musicGainNode: null,
  musicPlaying: false,
  musicStartTime: 0,
  musicPausedAt: 0,
  musicSource: null,
  musicBuffer: null,
  musicPlayList: [],
  currentTrackIndex: 0,

  // SFX properties
  sfxGainNode: null,
  sfxMap: new Map(),

  // Visibility state
  isVisible: true,
  wasPlayingBeforeHidden: false,
};

/**
 * Wait for user interaction before allowing audio
 * @returns {Promise<void>}
 */
function waitForUserInteraction() {
  return new Promise((resolve) => {
    if (audioState.userInteracted) {
      resolve();
      return;
    }

    const handleInteraction = () => {
      audioState.userInteracted = true;
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      resolve();
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);
  });
}

/**
 * Resume audio context if suspended
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
  if (audioState.context && audioState.context.state === "suspended") {
    try {
      await audioState.context.resume();
    } catch (error) {
      console.warn("Failed to resume audio context:", error);
    }
  }
}

/**
 * Initialize audio system
 * @param {string} [initialMusicUrl=null] - Optional initial music URL
 * @returns {Object} Current audio state
 */
export async function initAudio(initialMusicUrl = null) {
  if (audioState.initialized) return audioState;

  try {
    // Create audio context
    audioState.context = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create and connect music gain node
    audioState.musicGainNode = audioState.context.createGain();
    audioState.musicGainNode.gain.value = audioState.volume;
    audioState.musicGainNode.connect(audioState.context.destination);

    // Create and connect SFX gain node
    audioState.sfxGainNode = audioState.context.createGain();
    audioState.sfxGainNode.gain.value = audioState.volume;
    audioState.sfxGainNode.connect(audioState.context.destination);

    audioState.initialized = true;

    // Set up visibility change handling
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChangeInternal
    );

    // Load initial music if provided (but don't play yet)
    if (initialMusicUrl) {
      await loadMusic(initialMusicUrl, false);
    }

    return audioState;
  } catch (error) {
    console.error("Audio system initialization failed:", error);
    return audioState;
  }
}

/**
 * Internal visibility change handler
 */
function handleVisibilityChangeInternal() {
  const wasVisible = audioState.isVisible;
  audioState.isVisible = !document.hidden;

  if (!wasVisible && audioState.isVisible) {
    // Page became visible
    if (
      audioState.wasPlayingBeforeHidden &&
      audioState.enabled &&
      audioState.userInteracted
    ) {
      // Resume playback
      resumeAudioContext().then(() => {
        if (!audioState.musicPlaying) {
          playMusic(audioState.musicPausedAt, true);
        }
      });
    }
  } else if (wasVisible && !audioState.isVisible) {
    // Page became hidden
    audioState.wasPlayingBeforeHidden = audioState.musicPlaying;
    if (audioState.musicPlaying) {
      pauseMusic(true); // Immediately pause when hidden
    }
  }
}

/**
 * Add a song to the music playlist
 * @param {string} musicUrl - URL of the music to add
 * @returns {boolean} Success status
 */
export function addMusic(musicUrl) {
  if (audioState.musicPlayList.length >= MAX_PLAYLIST_LENGTH) {
    return false;
  }

  audioState.musicPlayList.push(musicUrl);
  return true;
}

/**
 * Add sound effect to the sfx map
 * @param {string} name - Identifier for the sound effect
 * @param {string} sfxUrl - URL of the sound effect file
 * @returns {boolean} Success status
 */
export function addSFX(name, sfxUrl) {
  audioState.sfxMap.set(name, sfxUrl);
  return true;
}

/**
 * Load background music
 * @param {string} musicUrl - URL of the music file
 * @param {boolean} [autoPlay=false] - Whether to auto-play after loading
 * @returns {Promise<boolean>} Promise resolving to success status
 */
export async function loadMusic(musicUrl, autoPlay = false) {
  if (!audioState.context) {
    return Promise.resolve(false);
  }

  try {
    const response = await fetch(musicUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioState.context.decodeAudioData(arrayBuffer);
    audioState.musicBuffer = buffer;

    // Reset paused position when loading new track
    audioState.musicPausedAt = 0;

    // Only auto-play if requested AND audio is enabled AND user has interacted AND page is visible
    if (
      autoPlay &&
      audioState.enabled &&
      audioState.userInteracted &&
      audioState.isVisible
    ) {
      await resumeAudioContext();
      playMusic();
    }
    return true;
  } catch (error) {
    console.error("Error loading background music:", error);
    return false;
  }
}

/**
 * Load a sound effect
 * @param {string} name - Identifier for the sound effect
 * @returns {Promise<boolean>} Promise resolving to success status
 */
export async function loadSFX(name) {
  if (!audioState.context || !audioState.sfxMap.has(name)) {
    return Promise.resolve(false);
  }

  const sfxUrl = audioState.sfxMap.get(name);

  try {
    const response = await fetch(sfxUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioState.context.decodeAudioData(arrayBuffer);
    audioState.sfxMap.set(name, buffer);
    return true;
  } catch (error) {
    console.error(`Error loading sound effect ${name}:`, error);
    return false;
  }
}

/**
 * Play a sound effect
 * @param {string} name - Identifier for the sound effect
 * @param {number} [volume=1] - Volume modifier for this sound (0-1)
 * @returns {Promise<boolean>} Success status
 */
export async function playSFX(name, volume = 1) {
  if (
    !audioState.context ||
    !audioState.enabled ||
    !audioState.sfxMap.has(name) ||
    !audioState.isVisible
  ) {
    return false;
  }

  if (!audioState.userInteracted) {
    await waitForUserInteraction();
  }

  await resumeAudioContext();

  const buffer = audioState.sfxMap.get(name);

  if (!(buffer instanceof AudioBuffer)) {
    await loadSFX(name);
    return false;
  }

  const source = audioState.context.createBufferSource();
  source.buffer = buffer;

  const gainNode = audioState.context.createGain();
  gainNode.gain.value = audioState.volume * volume;

  source.connect(gainNode);
  gainNode.connect(audioState.sfxGainNode);

  source.start(0);
  return true;
}

/**
 * Play background music
 * @param {number} [resumeFromPosition=0] - Position to resume from
 * @param {boolean} [immediate=false] - Whether to start immediately without fade-in
 * @returns {Promise<boolean>} Success status
 */
export async function playMusic(resumeFromPosition = 0, immediate = false) {
  // Don't play if page is hidden
  if (!audioState.isVisible) {
    return false;
  }

  // Skip if not ready or already playing
  if (
    !audioState.context ||
    !audioState.musicBuffer ||
    audioState.musicPlaying ||
    !audioState.enabled
  ) {
    return false;
  }

  if (!audioState.userInteracted) {
    await waitForUserInteraction();
  }

  await resumeAudioContext();

  // Stop any existing source
  if (audioState.musicSource) {
    try {
      audioState.musicSource.stop();
      audioState.musicSource.disconnect();
    } catch (e) {
      // Source might already be stopped
    }
    audioState.musicSource = null;
  }

  // Create and connect source node
  const source = audioState.context.createBufferSource();
  source.buffer = audioState.musicBuffer;
  source.loop = true;
  source.connect(audioState.musicGainNode);

  // Use the stored paused position if resumeFromPosition is 0
  const startPosition = resumeFromPosition || audioState.musicPausedAt;

  if (immediate) {
    audioState.musicGainNode.gain.setValueAtTime(
      audioState.volume,
      audioState.context.currentTime
    );
  } else {
    audioState.musicGainNode.gain.setValueAtTime(
      0,
      audioState.context.currentTime
    );
    audioState.musicGainNode.gain.linearRampToValueAtTime(
      audioState.volume,
      audioState.context.currentTime + 1
    );
  }

  // Start playback
  source.start(0, startPosition);

  // Handle track ending
  source.addEventListener("ended", () => {
    if (audioState.musicSource === source) {
      audioState.musicPlaying = false;
      audioState.musicSource = null;
      playNextTrack();
    }
  });

  // Update state
  audioState.musicSource = source;
  audioState.musicStartTime = audioState.context.currentTime - startPosition;
  audioState.musicPlaying = true;

  return true;
}

/**
 * Pause background music (true pause, can be resumed)
 * @param {boolean} [immediate=false] - Whether to pause immediately without fade-out
 * @returns {boolean} Success status
 */
export function pauseMusic(immediate = false) {
  if (!audioState.musicSource || !audioState.musicPlaying) {
    return false;
  }

  // Store current position
  if (audioState.context && audioState.musicBuffer) {
    const elapsed = audioState.context.currentTime - audioState.musicStartTime;
    audioState.musicPausedAt = elapsed % audioState.musicBuffer.duration;
  }

  // Update state first
  audioState.musicPlaying = false;

  if (immediate) {
    // Stop immediately
    try {
      audioState.musicSource.stop();
      audioState.musicSource.disconnect();
    } catch (e) {
      // Source might already be stopped
    }
    audioState.musicSource = null;
  } else {
    // Fade out
    audioState.musicGainNode.gain.setValueAtTime(
      audioState.musicGainNode.gain.value,
      audioState.context.currentTime
    );
    audioState.musicGainNode.gain.linearRampToValueAtTime(
      0,
      audioState.context.currentTime + 0.5
    );

    const currentSource = audioState.musicSource;
    setTimeout(() => {
      if (currentSource === audioState.musicSource) {
        try {
          currentSource.stop();
          currentSource.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
        audioState.musicSource = null;
      }
    }, 500);
  }

  return true;
}

/**
 * Stop background music completely
 * @param {boolean} [immediate=false] - Whether to stop immediately without fade-out
 * @returns {boolean} Success status
 */
export function stopMusic(immediate = false) {
  if (!audioState.musicSource) {
    return false;
  }

  // Reset position
  audioState.musicPausedAt = 0;
  audioState.musicPlaying = false;

  if (immediate) {
    try {
      audioState.musicSource.stop();
      audioState.musicSource.disconnect();
    } catch (e) {
      // Source might already be stopped
    }
    audioState.musicSource = null;
  } else {
    audioState.musicGainNode.gain.setValueAtTime(
      audioState.musicGainNode.gain.value,
      audioState.context.currentTime
    );
    audioState.musicGainNode.gain.linearRampToValueAtTime(
      0,
      audioState.context.currentTime + 0.5
    );

    const currentSource = audioState.musicSource;
    setTimeout(() => {
      if (currentSource === audioState.musicSource) {
        try {
          currentSource.stop();
          currentSource.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
        audioState.musicSource = null;
      }
    }, 500);
  }

  return true;
}

/**
 * Toggle background music on/off
 * @param {boolean} [immediate=false] - Whether to toggle immediately without fades
 * @returns {Promise<boolean>} New audio enabled state
 */
export async function toggleAudio(immediate = false) {
  audioState.enabled = !audioState.enabled;

  if (audioState.enabled) {
    if (!audioState.initialized) {
      await initAudio();
      return audioState.enabled;
    }

    if (!audioState.userInteracted) {
      await waitForUserInteraction();
    }

    await resumeAudioContext();

    // Update gain nodes
    const targetVolume = audioState.volume;
    if (audioState.musicGainNode) {
      if (immediate) {
        audioState.musicGainNode.gain.setValueAtTime(
          targetVolume,
          audioState.context.currentTime
        );
      } else {
        audioState.musicGainNode.gain.setTargetAtTime(
          targetVolume,
          audioState.context.currentTime,
          0.1
        );
      }
    }

    if (audioState.sfxGainNode) {
      if (immediate) {
        audioState.sfxGainNode.gain.setValueAtTime(
          targetVolume,
          audioState.context.currentTime
        );
      } else {
        audioState.sfxGainNode.gain.setTargetAtTime(
          targetVolume,
          audioState.context.currentTime,
          0.1
        );
      }
    }
  } else {
    // Audio is now disabled - pause current playback
    if (audioState.musicPlaying) {
      pauseMusic(immediate);
    }
  }

  return audioState.enabled;
}

/**
 * Update audio volume
 * @param {number} volume - Volume level between 0 and 1
 * @param {boolean} [immediate=false] - Whether to change volume immediately
 * @returns {number} New volume level
 */
export function setVolume(volume, immediate = false) {
  // Clamp volume between 0 and 1
  audioState.volume = Math.max(0, Math.min(1, volume));

  if (!audioState.initialized || !audioState.enabled) {
    return audioState.volume;
  }

  try {
    const time = audioState.context.currentTime;

    if (immediate) {
      if (audioState.musicGainNode) {
        audioState.musicGainNode.gain.setValueAtTime(audioState.volume, time);
      }
      if (audioState.sfxGainNode) {
        audioState.sfxGainNode.gain.setValueAtTime(audioState.volume, time);
      }
    } else {
      if (audioState.musicGainNode) {
        audioState.musicGainNode.gain.setTargetAtTime(
          audioState.volume,
          time,
          0.1
        );
      }
      if (audioState.sfxGainNode) {
        audioState.sfxGainNode.gain.setTargetAtTime(
          audioState.volume,
          time,
          0.1
        );
      }
    }
  } catch (error) {
    console.error("Error updating audio volume:", error);
  }

  return audioState.volume;
}

/**
 * Get the current volume level
 * @returns {number} Current volume (0-1)
 */
export function getVolume() {
  return audioState.volume;
}

/**
 * Check if audio is enabled
 * @returns {boolean} True if audio is enabled
 */
export function isAudioEnabled() {
  return audioState.enabled;
}

/**
 * Check if music is currently playing
 * @returns {boolean} True if music is playing
 */
export function isMusicPlaying() {
  return audioState.musicPlaying;
}

/**
 * Check if user has interacted with the page
 * @returns {boolean} True if user has interacted
 */
export function hasUserInteracted() {
  return audioState.userInteracted;
}

/**
 * Manually set user interaction state
 * @param {boolean} interacted - Whether user has interacted
 */
export function setUserInteracted(interacted) {
  audioState.userInteracted = interacted;
}

/**
 * Handle visibility change events (deprecated - handled internally now)
 * @param {boolean} isVisible - Whether the page is visible
 * @param {boolean} isGameView - Whether game view is active
 * @returns {Promise<boolean>} Success status
 */
export async function handleVisibilityChange(isVisible, isGameView) {
  // This is now handled internally, but kept for compatibility
  return true;
}

/**
 * Get the current playlist
 * @returns {Array<string>} Array of music URLs
 */
export function getPlaylist() {
  return [...audioState.musicPlayList];
}

/**
 * Get current track index
 * @returns {number} Current track index
 */
export function getCurrentTrackIndex() {
  return audioState.currentTrackIndex || 0;
}

/**
 * Set current track index
 * @param {number} index - Track index to set
 * @returns {boolean} Success status
 */
export function setCurrentTrackIndex(index) {
  if (index >= 0 && index < audioState.musicPlayList.length) {
    audioState.currentTrackIndex = index;
    return true;
  }
  return false;
}

/**
 * Get current playback position in seconds
 * @returns {number} Current position in seconds
 */
export function getCurrentPosition() {
  if (!audioState.context || !audioState.musicBuffer) {
    return audioState.musicPausedAt || 0;
  }

  if (audioState.musicPlaying && audioState.musicSource) {
    const elapsed = audioState.context.currentTime - audioState.musicStartTime;
    return elapsed % audioState.musicBuffer.duration;
  }

  return audioState.musicPausedAt || 0;
}

/**
 * Get track duration in seconds
 * @returns {number} Duration in seconds
 */
export function getDuration() {
  return audioState.musicBuffer ? audioState.musicBuffer.duration : 0;
}

/**
 * Seek to specific position in current track
 * @param {number} position - Position in seconds
 * @returns {Promise<boolean>} Success status
 */
export async function seekTo(position) {
  if (
    !audioState.musicBuffer ||
    position < 0 ||
    position > audioState.musicBuffer.duration
  ) {
    return false;
  }

  const wasPlaying = audioState.musicPlaying;

  // Always update the paused position
  audioState.musicPausedAt = position;

  // If currently playing, restart from new position
  if (wasPlaying) {
    pauseMusic(true);
    await playMusic(position, true);
  }

  return true;
}

/**
 * Load and play a specific track from the playlist
 * @param {number} index - Index of track to play
 * @returns {Promise<boolean>} Success status
 */
export async function loadAndPlayTrack(index) {
  if (index < 0 || index >= audioState.musicPlayList.length) {
    return false;
  }

  // Stop current music
  if (audioState.musicPlaying) {
    stopMusic(true);
  }

  // Set new track index
  audioState.currentTrackIndex = index;
  const trackUrl = audioState.musicPlayList[index];

  // Load new track
  const loaded = await loadMusic(trackUrl, false);
  if (!loaded) {
    return false;
  }

  // Play if audio is enabled and user has interacted and page is visible
  if (audioState.enabled && audioState.userInteracted && audioState.isVisible) {
    await resumeAudioContext();
    return await playMusic(0, true);
  }

  return true;
}

/**
 * Play next track in playlist
 * @returns {Promise<boolean>} Success status
 */
export async function playNextTrack() {
  const currentIndex = audioState.currentTrackIndex || 0;
  const nextIndex =
    currentIndex < audioState.musicPlayList.length - 1 ? currentIndex + 1 : 0;
  return await loadAndPlayTrack(nextIndex);
}

/**
 * Play previous track in playlist
 * @returns {Promise<boolean>} Success status
 */
export async function playPreviousTrack() {
  const currentIndex = audioState.currentTrackIndex || 0;
  const prevIndex =
    currentIndex > 0 ? currentIndex - 1 : audioState.musicPlayList.length - 1;
  return await loadAndPlayTrack(prevIndex);
}

/**
 * Clear the entire playlist
 * @returns {boolean} Success status
 */
export function clearPlaylist() {
  if (audioState.musicPlaying) {
    stopMusic(true);
  }

  audioState.musicPlayList = [];
  audioState.currentTrackIndex = 0;
  audioState.musicBuffer = null;

  return true;
}

/**
 * Remove a track from the playlist
 * @param {number} index - Index of track to remove
 * @returns {boolean} Success status
 */
export function removeFromPlaylist(index) {
  if (index < 0 || index >= audioState.musicPlayList.length) {
    return false;
  }

  const currentIndex = audioState.currentTrackIndex || 0;

  if (index === currentIndex) {
    stopMusic(true);
    audioState.musicBuffer = null;
  }

  audioState.musicPlayList.splice(index, 1);

  if (index < currentIndex) {
    audioState.currentTrackIndex = currentIndex - 1;
  } else if (index === currentIndex && audioState.musicPlayList.length > 0) {
    audioState.currentTrackIndex = Math.min(
      currentIndex,
      audioState.musicPlayList.length - 1
    );
  } else if (audioState.musicPlayList.length === 0) {
    audioState.currentTrackIndex = 0;
  }

  return true;
}

/**
 * Shuffle the playlist
 * @returns {boolean} Success status
 */
export function shufflePlaylist() {
  if (audioState.musicPlayList.length <= 1) {
    return false;
  }

  const currentTrack =
    audioState.musicPlayList[audioState.currentTrackIndex || 0];

  for (let i = audioState.musicPlayList.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [audioState.musicPlayList[i], audioState.musicPlayList[j]] = [
      audioState.musicPlayList[j],
      audioState.musicPlayList[i],
    ];
  }

  audioState.currentTrackIndex = audioState.musicPlayList.indexOf(currentTrack);

  return true;
}

/**
 * Restore audio state after page visibility changes
 * @param {boolean} [immediate=true] - Whether to restore immediately without fades
 * @returns {Promise<boolean>} Success status
 */
export async function restoreAudioState(immediate = true) {
  if (!audioState.initialized || !audioState.isVisible) {
    return false;
  }

  if (audioState.enabled) {
    if (!audioState.userInteracted) {
      await waitForUserInteraction();
    }

    await resumeAudioContext();

    if (!audioState.musicPlaying && audioState.musicBuffer) {
      await playMusic(audioState.musicPausedAt, immediate);
    }

    const targetVolume = audioState.volume;
    if (immediate) {
      if (audioState.musicGainNode) {
        audioState.musicGainNode.gain.setValueAtTime(
          targetVolume,
          audioState.context.currentTime
        );
      }
      if (audioState.sfxGainNode) {
        audioState.sfxGainNode.gain.setValueAtTime(
          targetVolume,
          audioState.context.currentTime
        );
      }
    } else {
      if (audioState.musicGainNode) {
        audioState.musicGainNode.gain.setTargetAtTime(
          targetVolume,
          audioState.context.currentTime,
          0.1
        );
      }
      if (audioState.sfxGainNode) {
        audioState.sfxGainNode.gain.setTargetAtTime(
          targetVolume,
          audioState.context.currentTime,
          0.1
        );
      }
    }
  }

  return true;
}

export function dispose() {
  // Remove visibility listener
  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChangeInternal
  );

  // Stop audio
  if (audioState.musicSource && audioState.musicPlaying) {
    try {
      audioState.musicSource.stop();
      audioState.musicSource.disconnect();
    } catch (e) {
      // Source might already be stopped
    }
  }

  // Disconnect nodes
  if (audioState.musicGainNode) {
    audioState.musicGainNode.disconnect();
  }

  if (audioState.sfxGainNode) {
    audioState.sfxGainNode.disconnect();
  }

  // Close context
  if (audioState.context) {
    audioState.context.close();
  }

  // Save settings
  const wasEnabled = audioState.enabled;
  const lastVolume = audioState.volume;
  const hadInteraction = audioState.userInteracted;
  const currentIndex = audioState.currentTrackIndex || 0;
  const savedPlaylist = [...audioState.musicPlayList];

  // Reset state
  audioState = {
    context: null,
    enabled: wasEnabled,
    volume: lastVolume,
    initialized: false,
    userInteracted: hadInteraction,

    musicGainNode: null,
    musicPlaying: false,
    musicStartTime: 0,
    musicPausedAt: 0,
    musicSource: null,
    musicBuffer: null,
    musicPlayList: savedPlaylist,
    currentTrackIndex: currentIndex,

    sfxGainNode: null,
    sfxMap: new Map(),

    isVisible: true,
    wasPlayingBeforeHidden: false,
  };

  return true;
}
