import { createSignal, Show, createMemo } from "solid-js";
import ResumeModal from "./ResumeModal";
import { createThemeManager } from "../../stores/theme";
import me from "../../assets/me.png";
import resume from "../../assets/David_Solinsky_resume.pdf";
const DocumentIcon = (props) => (
  <svg
    {...props}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    ></path>
  </svg>
);

const DownloadIcon = (props) => (
  <svg
    {...props}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    ></path>
  </svg>
);

const ItchIoIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M3.13 1.338C2.08 1.96.02 4.328 0 4.886c0 1.197 0 5.013.435 6.95a7.306 7.306 0 0 0 2.092 3.614c.995.73 2.307 1.08 3.83 1.08 2.44 0 5.207-1.118 7.844-1.118 2.998 0 5.903 1.118 7.841 1.118 1.524 0 2.836-.35 3.83-1.08a7.306 7.306 0 0 0 2.092-3.613c.435-1.938.435-5.754.435-6.95-.17-.56-2.078-2.925-3.13-3.548-5.943-2.057-7.568-2.057-12.169-2.057-4.6 0-6.225 0-12.168 2.057zM7.141 6.02c1.09 0 2.328.486 3.634 1.338.523.34 1.154.526 1.825.526.67 0 1.3-.187 1.825-.526 1.306-.852 2.543-1.338 3.634-1.338 1.936 0 2.741 1.74 2.92 3.68.181 1.937.372 3.549-1.634 3.549-.816 0-1.851-.367-2.65-.659-.744-.273-1.854-.559-3.092-.559s-2.161.286-2.907.56c-.798.291-1.812.658-2.65.658-2.005 0-1.815-1.612-1.633-3.55.18-1.938.985-3.68 2.921-3.68zM5.203 18.657c-1.89 0-2.545-.452-3.174-.96-.629.96-.93 2.426-.93 3.527C1.1 22.444 2.013 24 3.33 24s2.23-.614 2.23-1.37v-3.972zm14.767 0v3.972c0 .756.913 1.37 2.23 1.37s2.23-1.556 2.23-2.775c0-1.1-.258-2.518-.887-3.474-.629.454-1.284.907-3.573.907z" />
  </svg>
);

const ChevronDownIcon = (props) => (
  <svg
    {...props}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 9l-7 7-7-7"
    ></path>
  </svg>
);

const AboutSection = () => {
  const [expanded, setExpanded] = createSignal(false);
  const [showResumeModal, setShowResumeModal] = createSignal(false);
  const { isDark } = createThemeManager();

  const styles = createMemo(() => ({
    heading: `text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-800"} mb-2 transition-colors duration-300`,
    jobTitle: `inline-flex items-center gap-2 ${isDark() ? "text-gray-300" : "text-gray-600"} mb-4`,
    statusDot: `h-2 w-2 rounded-full ${isDark() ? "bg-blue-400" : "bg-blue-600"} animate-pulse`,
    paragraph: `${isDark() ? "text-gray-300" : "text-gray-700"} leading-relaxed`,
    expandButton: `${isDark() ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-800"} font-medium flex items-center transition-colors duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 rounded px-2 py-1 -ml-2`,
    expandedContent: `overflow-hidden transition-all duration-300 ${expanded() ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`,
    divider: `mt-8 pt-6 border-t ${isDark() ? "border-gray-700" : "border-gray-200"}`,
  }));

  // Handle image error once, not on every render
  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite error loop
    e.target.style.backgroundColor = "#3b82f6";
    e.target.style.border = "4px solid #93c5fd";
  };

  return (
    <section class="py-12 w-full max-w-4xl mx-auto" data-testid="about-section">
      {/* Profile section with image and intro */}
      <div class="flex flex-col md:flex-row gap-8 items-center">
        <div class="relative group">
          <div class="w-48 h-48 rounded-full overflow-hidden border-4 transition-all duration-300 group-hover:border-blue-400 border-blue-200 flex-shrink-0 shadow-lg">
            <img
              src={me}
              alt="Game Developer"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={handleImageError}
              loading="lazy"
            />
          </div>
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div class="flex-grow text-center md:text-left">
          <h2 class={styles().heading}>David Solinsky</h2>
          <div class={styles().jobTitle}>
            <span class="font-medium text-lg">Game Developer & 3D Artist</span>
            <span class={styles().statusDot}></span>
          </div>

          <p class={styles().paragraph}>
            I'm a passionate game developer with 3 years of experience in
            software engineering and gameplay programming. My expertise spans
            game development in engines like Unity and Godot, as well as C/C++
            programming creating immersive experiences.
          </p>
        </div>
      </div>

      {/* Bio section with expandable content */}
      <div class="mt-8 space-y-4">
        <p class={styles().paragraph}>
          With a background in computer science and a lifelong love for gaming,
          I blend technical expertise with creative vision to develop unique
          gaming experiences that engage and inspire players.
        </p>

        {/* Expandable content */}
        <div class={styles().expandedContent}>
          <div class="space-y-4 pt-4" id="expanded-bio">
            <p class={styles().paragraph}>I'm losing it</p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded())}
          class={styles().expandButton}
          aria-expanded={expanded()}
          aria-controls="expanded-bio"
        >
          <span>{expanded() ? "Show Less" : "Read More"}</span>
          <ChevronDownIcon
            class={`ml-1 w-4 h-4 transition-transform duration-300 ${expanded() ? "rotate-180" : ""} group-hover:translate-y-0.5`}
          />
        </button>
      </div>

      {/* Action buttons section */}
      <div class={styles().divider}>
        <div class="flex flex-wrap gap-4">
          <button
            onClick={() => setShowResumeModal(true)}
            class="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            aria-label="View Resume"
          >
            <DocumentIcon class="w-5 h-5 mr-2" />
            View Resume
          </button>

          <a
            href={resume}
            class="inline-flex items-center bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            target="_blank"
            download
            aria-label="Download Resume PDF"
          >
            <DownloadIcon class="w-5 h-5 mr-2" />
            Download Resume
          </a>

          <a
            href="https://smeppu.itch.io/"
            class="inline-flex items-center bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Itch.io Portfolio"
          >
            <ItchIoIcon class="w-5 h-5 mr-2" />
            Itch.io Portfolio
          </a>
        </div>
      </div>

      {/* Resume Modal */}
      <Show when={showResumeModal()}>
        <ResumeModal onClose={() => setShowResumeModal(false)} />
      </Show>
    </section>
  );
};

export default AboutSection;
