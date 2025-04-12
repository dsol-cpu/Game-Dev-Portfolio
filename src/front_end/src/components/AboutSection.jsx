import { createSignal, Show } from "solid-js";
import ResumeModal from "./ResumeModal";
import { createThemeManager } from "../stores/theme";
import me from "../assets/me.png";
import resume from "../assets/David_Solinsky_resume.pdf";
import Icon from "./icons/Icon";

const AboutSection = () => {
  const [showResumeModal, setShowResumeModal] = createSignal(false);
  const { isDark } = createThemeManager();

  const socialLinks = [
    {
      href: "https://smeppu.itch.io/",
      label: "Itch.io Portfolio",
      icon: "itch",
      className: "text-red-400 hover:text-red-300",
    },
    {
      href: "https://github.com/dsol-cpu/",
      label: "GitHub",
      icon: "github",
      className: `text-gray-300 hover:text-white ${!isDark() ? "text-white" : ""}`,
    },
    {
      href: "https://www.linkedin.com/in/david-solinsky/",
      label: "LinkedIn",
      icon: "linkedin",
      className: "text-blue-400 hover:text-white",
    },
  ];

  return (
    <section class="w-full py-8 relative" data-testid="about-section">
      {/* Background color strip */}
      <div
        class={`absolute top-0 left-0 right-0 h-full ${isDark() ? "bg-gray-900" : "bg-blue-900"}`}
      ></div>

      <div class="container mx-auto px-4 sm:px-6 relative z-10">
        <div class="flex flex-col items-center">
          {/* Profile image with status */}
          <div class="relative mb-6">
            <div class="w-40 h-40 rounded-full overflow-hidden border-4 border-blue-400 shadow-lg">
              <img
                src={me}
                alt="David Solinsky"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div class="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-blue-300 animate-pulse border border-blue-900"></div>
          </div>

          {/* Name and title */}
          <h2 class="text-3xl sm:text-4xl font-bold text-blue-300 mb-2">
            David Solinsky
          </h2>
          <p class="text-xl sm:text-2xl text-gray-300 mb-6">
            Gameplay & Systems Programmer
          </p>

          {/* Bio text */}
          <p class="w-full max-w-2xl text-center mb-8 text-gray-300 leading-relaxed">
            Passionate game developer with 3 years of experience in Unity,
            Godot, and C/C++ programming. Blending technical expertise with
            creative vision to craft engaging gaming experiences.
          </p>

          {/* Social links */}
          <div class="flex items-center gap-6 mb-8">
            {socialLinks.map((link) => (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                class={`transition-colors ${link.className}`}
                aria-label={link.label}
              >
                <Icon name={link.icon} class="w-8 h-8" />
              </a>
            ))}
          </div>

          {/* Resume buttons */}
          <div class="w-full max-w-md flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowResumeModal(true)}
              class="py-3 px-6 rounded-lg flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Icon name="resume" class="w-5 h-5 mr-2" />
              View Resume
            </button>

            <a
              href={resume}
              download
              class="py-3 px-6 rounded-lg flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              <Icon name="download" class="w-5 h-5 mr-2" />
              Download Resume
            </a>
          </div>
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
