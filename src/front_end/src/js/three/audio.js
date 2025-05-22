const MAX_PLAYLIST_LENGTH = 25;

let audioState = {
  // Core audio system
  context: null,
  enabled: true,
  volume: 0.125,
  initialized: false,
  userInteracted: false, // Track if user has interacted with the page

  // Music properties
  musicGainNode: null,
  musicPlaying: false,
  musicStartTime: 0,
  musicPausedAt: 0,
  musicSource: null,
  musicBuffer: null,
  musicPlayList: [],

  // SFX properties
  sfxGainNode: null,
  sfxMap: new Map(),
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

    // Load initial music if provided (but don't play yet)
    if (initialMusicUrl) {
      await loadMusic(initialMusicUrl, false); // Don't auto-play
    }

    return audioState;
  } catch (error) {
    console.error("Audio system initialization failed:", error);
    return audioState;
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

    // Only auto-play if requested AND audio is enabled AND user has interacted
    if (autoPlay && audioState.enabled && audioState.userInteracted) {
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
    // Store buffer instead of URL
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
    !audioState.sfxMap.has(name)
  ) {
    return false;
  }

  // Wait for user interaction if needed
  if (!audioState.userInteracted) {
    await waitForUserInteraction();
  }

  await resumeAudioContext();

  const buffer = audioState.sfxMap.get(name);

  // Skip if we don't have the buffer yet (just URL)
  if (!(buffer instanceof AudioBuffer)) {
    // Try to load it first
    await loadSFX(name);
    return false;
  }

  // Create and connect source
  const source = audioState.context.createBufferSource();
  source.buffer = buffer;

  // Create a gain node for this specific sound
  const gainNode = audioState.context.createGain();
  gainNode.gain.value = audioState.volume * volume;

  source.connect(gainNode);
  gainNode.connect(audioState.sfxGainNode);

  // Play the sound
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
  // Skip if not ready or already playing
  if (
    !audioState.context ||
    !audioState.musicBuffer ||
    audioState.musicPlaying
  ) {
    return false;
  }

  // Wait for user interaction if needed
  if (!audioState.userInteracted) {
    await waitForUserInteraction();
  }

  // Resume suspended context if needed
  await resumeAudioContext();

  // Create and connect source node
  const source = audioState.context.createBufferSource();
  source.buffer = audioState.musicBuffer;
  source.loop = true;
  source.connect(audioState.musicGainNode);

  const currentVolume = audioState.enabled ? audioState.volume : 0;

  if (immediate) {
    // Set volume immediately
    audioState.musicGainNode.gain.setValueAtTime(
      currentVolume,
      audioState.context.currentTime
    );
  } else {
    // Fade in
    audioState.musicGainNode.gain.setValueAtTime(
      0,
      audioState.context.currentTime
    );
    audioState.musicGainNode.gain.linearRampToValueAtTime(
      currentVolume,
      audioState.context.currentTime + 1
    );
  }

  // Start playback
  source.start(0, resumeFromPosition);

  // Update state
  audioState.musicSource = source;
  audioState.musicStartTime =
    audioState.context.currentTime - resumeFromPosition;
  audioState.musicPlaying = true;

  return true;
}

/**
 * Pause background music
 * @param {boolean} [immediate=false] - Whether to pause immediately without fade-out
 * @returns {boolean} Success status
 */
export function pauseMusic(immediate = false) {
  if (!audioState.musicSource || !audioState.musicPlaying) {
    return false;
  }

  // Store current position
  audioState.musicPausedAt =
    (audioState.context.currentTime - audioState.musicStartTime) %
    audioState.musicBuffer.duration;

  // Stop playing
  audioState.musicPlaying = false;

  if (immediate) {
    // Stop immediately
    audioState.musicSource.stop();
    audioState.musicSource.disconnect();
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

    // Store reference then stop after fade
    const currentSource = audioState.musicSource;

    // Stop after fade completes
    setTimeout(() => {
      if (currentSource) {
        currentSource.stop();
        currentSource.disconnect();
      }
      audioState.musicSource = null;
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
    // Stop immediately
    audioState.musicSource.stop();
    audioState.musicSource.disconnect();
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

    // Store reference then stop after fade
    const currentSource = audioState.musicSource;

    // Stop after fade completes
    setTimeout(() => {
      if (currentSource) {
        currentSource.stop();
        currentSource.disconnect();
      }
      audioState.musicSource = null;
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

  // If audio is now enabled
  if (audioState.enabled) {
    // Initialize if needed
    if (!audioState.initialized) {
      initAudio();
      return audioState.enabled;
    }

    // Wait for user interaction if needed
    if (!audioState.userInteracted) {
      await waitForUserInteraction();
    }

    await resumeAudioContext();

    // Set volume
    if (audioState.musicGainNode) {
      if (immediate) {
        audioState.musicGainNode.gain.setValueAtTime(
          audioState.volume,
          audioState.context.currentTime
        );
      } else {
        audioState.musicGainNode.gain.setTargetAtTime(
          audioState.volume,
          audioState.context.currentTime,
          0.1
        );
      }
    }

    // Play if not already playing
    if (!audioState.musicPlaying && audioState.musicBuffer) {
      await playMusic(audioState.musicPausedAt, immediate);
    }
  } else {
    // Audio is now disabled
    if (audioState.musicGainNode) {
      if (immediate) {
        // Mute immediately
        audioState.musicGainNode.gain.setValueAtTime(
          0,
          audioState.context.currentTime
        );
        // Pause audio
        pauseMusic(true);
      } else {
        // Fade out
        audioState.musicGainNode.gain.setTargetAtTime(
          0,
          audioState.context.currentTime,
          0.1
        );
        // pauseMusic will be called by the fade timeout
      }
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
  if (!audioState.initialized) {
    audioState.volume = Math.max(0, Math.min(1, volume));
    return audioState.volume;
  }

  // Clamp volume between 0 and 1
  audioState.volume = Math.max(0, Math.min(1, volume));

  // Only apply if audio is enabled
  if (audioState.enabled) {
    try {
      const time = audioState.context.currentTime;

      if (immediate) {
        // Set volume immediately
        audioState.musicGainNode.gain.setValueAtTime(audioState.volume, time);
        audioState.sfxGainNode.gain.setValueAtTime(audioState.volume, time);
      } else {
        // Smooth transition
        audioState.musicGainNode.gain.setTargetAtTime(
          audioState.volume,
          time,
          0.1
        );
        audioState.sfxGainNode.gain.setTargetAtTime(
          audioState.volume,
          time,
          0.1
        );
      }
    } catch (error) {
      console.error("Error updating audio volume:", error);
    }
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
 * Manually set user interaction state (useful for testing or special cases)
 * @param {boolean} interacted - Whether user has interacted
 */
export function setUserInteracted(interacted) {
  audioState.userInteracted = interacted;
}

/**
 * Restore audio state after page visibility changes
 * @param {boolean} [immediate=true] - Whether to restore immediately without fades
 * @returns {Promise<boolean>} Success status
 */
export async function restoreAudioState(immediate = true) {
  if (!audioState.initialized) {
    return false;
  }

  if (audioState.enabled) {
    // Wait for user interaction if needed
    if (!audioState.userInteracted) {
      await waitForUserInteraction();
    }

    await resumeAudioContext();

    // Resume if it should be playing
    if (!audioState.musicPlaying && audioState.musicBuffer) {
      await playMusic(audioState.musicPausedAt, immediate);
    }

    // Reset volume
    if (immediate) {
      audioState.musicGainNode.gain.setValueAtTime(
        audioState.volume,
        audioState.context.currentTime
      );
      audioState.sfxGainNode.gain.setValueAtTime(
        audioState.volume,
        audioState.context.currentTime
      );
    } else {
      audioState.musicGainNode.gain.setTargetAtTime(
        audioState.volume,
        audioState.context.currentTime,
        0.1
      );
      audioState.sfxGainNode.gain.setTargetAtTime(
        audioState.volume,
        audioState.context.currentTime,
        0.1
      );
    }
  }

  return true;
}

/**
 * Handle visibility change events
 * @param {boolean} isVisible - Whether the page is visible
 * @param {boolean} isGameView - Whether game view is active
 * @returns {Promise<boolean>} Success status
 */
export async function handleVisibilityChange(isVisible, isGameView) {
  if (!audioState.initialized) {
    return false;
  }

  if (!isVisible && audioState.musicPlaying) {
    // Pause when hidden
    pauseMusic(true);
    return true;
  } else if (
    isVisible &&
    isGameView &&
    audioState.enabled &&
    !audioState.musicPlaying &&
    audioState.userInteracted
  ) {
    // Resume when visible in game view (only if user has interacted)
    await resumeAudioContext();
    await playMusic(audioState.musicPausedAt, true);
    return true;
  }

  return false;
}

/**
 * Clean up audio resources
 * @returns {boolean} Success status
 */
export function dispose() {
  // Stop audio
  if (audioState.musicSource && audioState.musicPlaying) {
    audioState.musicSource.stop();
    audioState.musicSource.disconnect();
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

  // Reset state
  audioState = {
    context: null,
    enabled: wasEnabled,
    volume: lastVolume,
    initialized: false,
    userInteracted: hadInteraction, // Keep interaction state

    musicGainNode: null,
    musicPlaying: false,
    musicStartTime: 0,
    musicPausedAt: 0,
    musicSource: null,
    musicBuffer: null,
    musicPlayList: [],

    sfxGainNode: null,
    sfxMap: new Map(),
  };

  return true;
}
