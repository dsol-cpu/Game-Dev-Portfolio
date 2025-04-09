import { createSignal, Show, createMemo } from "solid-js";
import ResumeModal from "./ResumeModal";
import { createThemeManager } from "../../stores/theme";
import me from "../../assets/me.png";
import resume from "../../assets/David_Solinsky_resume.pdf";
import Icon from "../icons/Icon";

const ResumeIcon = <Icon name="resume" class="w-5 h-5 mr-2" />;
const DownloadIcon = <Icon name="download" class="w-5 h-5 mr-2" />;
const ItchIoIcon = <Icon name="itch" class="w-5 h-5 mr-2" />;
const ChevronDownIcon = (props) => <Icon name="chevron-down" {...props} />;

const AboutSection = () => {
  const [expanded, setExpanded] = createSignal(false);
  const [showResumeModal, setShowResumeModal] = createSignal(false);
  const { isDark } = createThemeManager();

  const styles = createMemo(() => ({
    heading: `text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-800"} mb-2 transition-colors duration-300`,
    jobTitle: `inline-flex items-center gap-2 ${isDark() ? "text-gray-300" : "text-gray-600"} mb-4`,
    statusDot: `h-2 w-2 rounded-full ${isDark() ? "bg-blue-400" : "bg-blue-600"} animate-pulse`,
    paragraph: `${isDark() ? "text-gray-300" : "text-gray-700"} leading-relaxed`,
    expandButton: `focus:outline-none ${isDark() ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-800"} font-medium flex items-center transition-colors duration-200 group focus:outline-none rounded px-2 py-1 -ml-2`,
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
            style={{
              transform: expanded() ? "rotate(180deg)" : "none",
            }}
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
            <ResumeIcon class="w-5 h-5 mr-2" />
            View Resume
          </button>

          <a
            href={resume}
            class="inline-flex items-center bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            target="_blank"
            download
            aria-label="Download Resume PDF"
          >
            <DownloadIcon />
            Download Resume
          </a>

          <a
            href="https://smeppu.itch.io/"
            class="inline-flex items-center bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Itch.io Portfolio"
          >
            <ItchIoIcon />
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
