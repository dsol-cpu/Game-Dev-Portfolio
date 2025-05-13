class AudioController {
  constructor() {
    // Audio state
    this.context = null;
    this.musicSource = null;
    this.musicBuffer = null;
    this.gainNode = null;
    this.playing = false;
    this.initialized = false;
    this.startTime = 0;
    this.pausedAt = 0;

    // Audio settings
    this.audioEnabled = true;
    this.lastVolume = 0.5; // Store the last volume level
  }

  /**
   * Initialize the audio system
   * @param {string} musicUrl - URL of the background music
   */
  init(musicUrl) {
    if (this.initialized) return;

    try {
      // Create audio context and gain node
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = this.lastVolume; // Use stored volume
      this.gainNode.connect(this.context.destination);

      // Load music
      this.loadMusic(musicUrl);
      this.initialized = true;
    } catch (error) {
      console.error("Audio system initialization failed:", error);
    }
  }

  /**
   * Load background music
   * @param {string} musicUrl - URL of the music file
   */
  loadMusic(musicUrl) {
    if (this.musicBuffer) return;

    fetch(musicUrl)
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => this.context.decodeAudioData(arrayBuffer))
      .then((buffer) => {
        this.musicBuffer = buffer;
        // Auto-play if audio is enabled
        if (this.audioEnabled) this.play();
      })
      .catch((error) =>
        console.error("Error loading background music:", error)
      );
  }

  /**
   * Play background music
   * @param {number} [resumeFromPosition=0] - Position to resume from
   */
  play(resumeFromPosition = 0) {
    // Skip if not ready or already playing
    if (!this.context || !this.musicBuffer || this.playing) return;

    // Resume suspended context first if needed
    if (this.context.state === "suspended") this.context.resume();

    // Create and connect source node
    this.musicSource = this.context.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.gainNode);

    // Fade in for smooth transition
    const currentVolume = this.audioEnabled ? this.lastVolume : 0;
    this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(
      currentVolume,
      this.context.currentTime + 1
    );

    // Start playback from specified position
    this.musicSource.start(0, resumeFromPosition);
    this.startTime = this.context.currentTime - resumeFromPosition;
    this.playing = true;
  }

  /**
   * Pause background music
   */
  pause() {
    if (!this.musicSource || !this.playing) return;

    // Calculate and store current position
    this.pausedAt =
      (this.context.currentTime - this.startTime) % this.musicBuffer.duration;

    // Fade out smoothly
    this.gainNode.gain.setValueAtTime(
      this.gainNode.gain.value,
      this.context.currentTime
    );
    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + 0.5
    );

    // Stop after fade completes
    setTimeout(() => {
      if (this.musicSource) {
        this.musicSource.stop();
        this.musicSource.disconnect();
        this.musicSource = null;
      }
      this.playing = false;
    }, 500);
  }

  /**
   * Stop background music completely
   */
  stop() {
    if (!this.musicSource) return;

    // Fade out smoothly
    this.gainNode.gain.setValueAtTime(
      this.gainNode.gain.value,
      this.context.currentTime
    );
    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + 0.5
    );

    // Stop after fade completes and reset
    setTimeout(() => {
      if (this.musicSource) {
        this.musicSource.stop();
        this.musicSource.disconnect();
        this.musicSource = null;
      }
      this.playing = false;
      this.pausedAt = 0;
    }, 500);
  }

  /**
   * Toggle background music on/off
   * @returns {boolean} New audio enabled state
   */
  toggleMusic() {
    this.audioEnabled = !this.audioEnabled;

    // If audio is now enabled
    if (this.audioEnabled) {
      // If not initialized, init first
      if (!this.initialized) {
        this.init("/audio/Little Jack (Nasrad, Ixa'taka, Valua).mp3");
        return this.audioEnabled;
      }

      // Restore volume to last known level
      if (this.gainNode) {
        this.gainNode.gain.setTargetAtTime(
          this.lastVolume,
          this.context.currentTime,
          0.1
        );
      }

      // Play if not already playing
      if (!this.playing) this.play(this.pausedAt);
    } else {
      // Mute but keep playing to maintain position
      if (this.gainNode) {
        this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
      }
    }

    return this.audioEnabled;
  }

  /**
   * Update audio volume
   * @param {number} volume - Volume level between 0 and 1
   */
  setVolume(volume) {
    if (!this.gainNode) {
      console.warn("Audio system not initialized. Cannot update volume.");
      return;
    }

    // Ensure volume is between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Store the last volume value (even when muted)
    this.lastVolume = clampedVolume;

    try {
      // Only apply volume if audio is enabled
      if (this.audioEnabled) {
        // Smoothly transition volume
        this.gainNode.gain.setTargetAtTime(
          clampedVolume,
          this.context.currentTime,
          0.1 // smooth transition time (100ms)
        );
      }

      // Update volume slider UI if it exists
      this.updateVolumeUI();
    } catch (error) {
      console.error("Error updating audio volume:", error);
    }
  }

  /**
   * Update the UI to match current audio state
   */
  updateVolumeUI() {
    const volumeSlider = document.getElementById("volume-slider");
    if (volumeSlider) {
      volumeSlider.value = this.lastVolume.toString();
    }
  }

  /**
   * Get the current volume level, regardless of mute state
   */
  getVolume() {
    return this.lastVolume;
  }

  /**
   * Restore audio state
   * Useful when coming back from hidden to visible state
   */
  restoreAudioState() {
    if (!this.initialized) return;

    if (this.audioEnabled) {
      // Resume playing if it should be playing
      if (!this.playing) {
        this.play(this.pausedAt);
      }

      // Make sure the volume is correct
      if (this.gainNode) {
        this.gainNode.gain.setTargetAtTime(
          this.lastVolume,
          this.context.currentTime,
          0.1
        );
      }
    }

    // Always update UI to keep it consistent
    this.updateVolumeUI();
  }

  /**
   * Dispose of audio resources
   */
  dispose() {
    // Stop and disconnect audio source
    if (this.musicSource) {
      if (this.playing) this.musicSource.stop();
      this.musicSource.disconnect();
      this.musicSource = null;
    }

    // Disconnect and close audio nodes
    if (this.gainNode) this.gainNode.disconnect();
    if (this.context) this.context.close();

    // Reset audio state
    this.playing = false;
    this.initialized = false;
    this.pausedAt = 0;
    // Do not reset audioEnabled and lastVolume as they should persist
  }
}

// Create a single instance to be imported and used across the application
export const audioController = new AudioController();

// Convenience export functions for easier use in other modules
export function toggleBackgroundMusic() {
  return audioController.toggleMusic();
}

export function updateAudioVolume(volume) {
  audioController.setVolume(volume);
}
