export const TimeManager = (() => {
  let lastTime = performance.now();
  let deltaTime = 0;
  let fixedDeltaTime;

  return {
    update: () => {
      const currentTime = performance.now();
      deltaTime = (currentTime - lastTime) / 1000; // Convert deltaTime to seconds
      lastTime = currentTime;
    },

    getDeltaTime: () => deltaTime,
    getFIxedDeltaTime: () => fixedDeltaTime,

    /**
     * Set up integration with user-interaction.js
     * @param {Function} isIdleFunction - Reference to the isIdle function
     * @param {Function} onIdleStateChangeFunction - Reference to register for idle state changes
     */
    setupUserInteractionIntegration(isIdleFunction, onIdleStateChangeFunction) {
      // Store reference to isIdle function if provided
      if (typeof isIdleFunction === "function") {
        this.isIdleFunction = isIdleFunction;
      }

      // Register for idle state changes if function provided
      if (typeof onIdleStateChangeFunction === "function") {
        onIdleStateChangeFunction((idleState) => {
          instance.isIdle = idleState;
        });
      }

      return this; // For chaining
    },
  };
})();

export default TimeManager;
