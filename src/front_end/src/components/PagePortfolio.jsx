// PagePortfolio.jsx
import { createSignal, onMount } from "solid-js";
import ProjectCard from "./UI/ProjectCard";
import AboutSection from "./UI/AboutSection";
import ContactSection from "./UI/ContactSection";
import SkillsSection from "./UI/SkillsSection";

const PagePortfolio = () => {
  const [activeSection, setActiveSection] = createSignal("about");
  const [projects, setProjects] = createSignal([
    {
      id: 1,
      title: "Space Explorer",
      description: "A 3D space exploration game built with Three.js and WebGL",
      technologies: ["Three.js", "JavaScript", "WebGL", "GLSL"],
      imageUrl: "/assets/images/projects/space-explorer.jpg",
      githubUrl: "https://github.com/yourusername/space-explorer",
      demoUrl: "https://space-explorer-demo.vercel.app",
    },
    {
      id: 2,
      title: "Quantum Quest",
      description: "RPG adventure game with unique quantum mechanics gameplay",
      technologies: ["Unity", "C#", "Shader Graph", "Blender"],
      imageUrl: "/assets/images/projects/quantum-quest.jpg",
      githubUrl: "https://github.com/yourusername/quantum-quest",
      demoUrl: "https://quantum-quest.itch.io",
    },
    {
      id: 3,
      title: "Arcadia Weather",
      description: "Weather visualization app inspired by Skies of Arcadia",
      technologies: ["React", "Three.js", "TailwindCSS", "Weather API"],
      imageUrl: "/assets/images/projects/arcadia-weather.jpg",
      githubUrl: "https://github.com/yourusername/arcadia-weather",
      demoUrl: "https://arcadia-weather.vercel.app",
    },
  ]);

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll("section[id]").forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  });

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div class="absolute inset-0 overflow-auto bg-blue-50 z-0 pt-16">
      <nav class="sticky top-0 bg-blue-900 text-amber-100 shadow-lg z-10">
        <div class="container mx-auto px-4 py-3">
          <ul class="flex justify-center space-x-6">
            {["about", "projects", "skills", "contact"].map((id) => (
              <li>
                <button
                  onClick={() => scrollToSection(id)}
                  class={`px-3 py-2 rounded ${
                    activeSection() === id
                      ? "bg-blue-800 border border-yellow-600"
                      : "hover:bg-blue-800"
                  }`}
                >
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div class="container mx-auto px-4 py-8">
        <section id="about" class="mb-16 scroll-mt-16">
          <div class="bg-white shadow-lg rounded-lg p-6 border-2 border-blue-200">
            <h2 class="text-3xl font-bold text-blue-900 mb-6 border-b-2 border-yellow-500 pb-2">
              About Me
            </h2>
            <AboutSection />
          </div>
        </section>

        <section id="projects" class="mb-16 scroll-mt-16">
          <div class="bg-white shadow-lg rounded-lg p-6 border-2 border-blue-200">
            <h2 class="text-3xl font-bold text-blue-900 mb-6 border-b-2 border-yellow-500 pb-2">
              Projects
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects().map((project) => (
                <ProjectCard project={project} />
              ))}
            </div>
          </div>
        </section>

        <section id="skills" class="mb-16 scroll-mt-16">
          <div class="bg-white shadow-lg rounded-lg p-6 border-2 border-blue-200">
            <h2 class="text-3xl font-bold text-blue-900 mb-6 border-b-2 border-yellow-500 pb-2">
              Skills
            </h2>
            <SkillsSection />
          </div>
        </section>

        <section id="contact" class="mb-16 scroll-mt-16">
          <div class="bg-white shadow-lg rounded-lg p-6 border-2 border-blue-200">
            <h2 class="text-3xl font-bold text-blue-900 mb-6 border-b-2 border-yellow-500 pb-2">
              Contact
            </h2>
            <ContactSection />
          </div>
        </section>
      </div>

      <footer class="bg-blue-900 text-amber-100 py-6">
        <div class="container mx-auto px-4 text-center">
          <p>
            © {new Date().getFullYear()} Your Game Dev Portfolio. All rights
            reserved.
          </p>
          <div class="flex justify-center mt-4 space-x-4">
            <a
              href="https://github.com/yourusername"
              class="hover:text-yellow-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/yourusername"
              class="hover:text-yellow-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <a
              href="https://twitter.com/yourusername"
              class="hover:text-yellow-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PagePortfolio;
