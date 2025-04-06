import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

// Create a singleton store to manage the resume modal state
const [resumeState, setResumeState] = createStore({
  isModalOpen: false,
});

// Expose actions to open/close the modal
export const resumeActions = {
  openResumeModal: () => setResumeState("isModalOpen", true),
  closeResumeModal: () => setResumeState("isModalOpen", false),
};

// Export the store and actions
export const resumeStore = {
  state: resumeState,
  ...resumeActions,
};
