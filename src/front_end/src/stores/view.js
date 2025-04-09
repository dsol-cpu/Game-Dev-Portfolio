import { createStore } from "solid-js/store";
import { createRoot } from "solid-js";

function createViewStore() {
  const [state, setState] = createStore({
    isScrollView: true,
  });

  const toggleView = () => {
    setState({ isScrollView: !state.isScrollView });

    // Dispatch custom event for legacy components that still rely on events
    window.dispatchEvent(
      new CustomEvent("toggleViewMode", {
        detail: {
          isScrollView: !state.isScrollView,
        },
      })
    );
  };

  const setScrollView = (value) => {
    setState({ isScrollView: value });

    // Dispatch custom event for legacy components that still rely on events
    window.dispatchEvent(
      new CustomEvent("toggleViewMode", {
        detail: {
          isScrollView: value,
        },
      })
    );
  };

  return {
    state,
    toggleView,
    setScrollView,
  };
}

export const viewStore = createRoot(createViewStore);
