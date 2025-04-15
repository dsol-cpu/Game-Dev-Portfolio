import { createSignal, Show } from "solid-js";

const ResumeSection = (props) => {
  const [isLoading, setIsLoading] = createSignal(true);

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          // Close when clicking the backdrop
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-200 p-4">
            <h3 class="text-xl font-bold text-blue-800">Resume</h3>
            <button
              onClick={props.onClose}
              class="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-hidden">
            {/* Loading spinner */}
            <Show when={isLoading()}>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
              </div>
            </Show>

            <iframe
              src="/resume.pdf"
              class="w-full h-full"
              onLoad={handleLoad}
              title="Resume"
            ></iframe>
          </div>

          {/* Footer */}
          <div class="border-t border-gray-200 p-4 flex justify-between items-center">
            <a
              href="/resume.pdf"
              class="inline-flex items-center text-blue-600 hover:text-blue-800"
              download
            >
              <svg
                class="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                ></path>
              </svg>
              Download PDF
            </a>
            <button
              onClick={props.onClose}
              class="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ResumeSection;
