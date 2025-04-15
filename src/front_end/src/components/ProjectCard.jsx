import {
  createSignal,
  createEffect,
  Show,
  For,
  onMount,
  onCleanup,
} from "solid-js";
import ModelViewer from "./models/ModelViewer";
import Icon from "./icons/Icon";

/**
 * ProjectCard - Project card with 3D model viewer
 */
const ProjectCard = (props) => {
  const {
    id,
    title,
    description,
    modelId,
    modelUrl,
    company,
    period,
    category,
    technologies = [],
    imageUrl,
    videoLink,
    storeLink,
    githubLink,
    responsibilities = [],
    getCategoryLabel,
  } = props;

  // Create a default theme object in case one isn't provided
  const theme = props.theme || {
    cardBg: "bg-white dark:bg-gray-800",
    gradient: "bg-gradient-to-t from-black/70 to-black/20",
    subheadingText: "text-gray-800 dark:text-gray-200",
    bodyText: "text-gray-600 dark:text-gray-300",
    techBadge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    moreBadge: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    detailsBtn: "text-blue-600 dark:text-blue-400",
    divider: "border-gray-200 dark:border-gray-700",
    videoClass: "text-red-600 dark:text-red-400",
    storeClass: "text-green-600 dark:text-green-400",
    githubClass: "text-gray-700 dark:text-gray-300",
    linkHover: "hover:opacity-80",
  };

  const [isModelLoaded, setIsModelLoaded] = createSignal(false);
  const [expandedProject, setExpandedProject] = createSignal(null);
  const [modelVisible, setModelVisible] = createSignal(props.visible !== false);
  let modelContainerRef;

  const toggleProject = (projectId) => {
    setExpandedProject(expandedProject() === projectId ? null : projectId);
  };

  // Handler for when model is loaded
  const handleModelLoaded = (model) => {
    console.log(`[ProjectCard ${id}] Model loaded for ${modelId || modelUrl}`);
    setIsModelLoaded(true);
  };

  // Handler for model errors
  const handleModelError = (error) => {
    console.error(
      `[ProjectCard ${id}] Error loading model for ${modelId || modelUrl}:`,
      error
    );
    setIsModelLoaded(false);
  };

  // Track component visibility from props - react to changes
  createEffect(() => {
    const isVisible = props.visible !== false;
    console.log(`[ProjectCard ${id}] Visibility changed to: ${isVisible}`);
    setModelVisible(isVisible);
  });

  onMount(() => {
    console.log(
      `[ProjectCard ${id}] Component mounted, modelId: ${modelId}, visible: ${modelVisible()}`
    );

    if (modelContainerRef) {
      // Make sure the model container allows pointer events
      modelContainerRef.style.pointerEvents = "auto";
    }
  });

  onCleanup(() => {
    console.log(`[ProjectCard ${id}] Component unmounting`);
  });

  // Handle missing components gracefully
  const TechBadge =
    props.TechBadge ||
    ((props) => (
      <span
        class={`px-3 py-1 rounded-full text-xs font-medium ${props.classes}`}
      >
        {props.tech}
      </span>
    ));

  const SocialLinks =
    props.SocialLinks ||
    ((props) => (
      <div class="flex gap-3">
        {props.videoLink && (
          <a
            href={props.videoLink}
            class={`${props.videoClass} ${props.hoverClass}`}
            title="Video"
          >
            📹
          </a>
        )}
        {props.storeLink && (
          <a
            href={props.storeLink}
            class={`${props.storeClass} ${props.hoverClass}`}
            title="Store"
          >
            🛒
          </a>
        )}
        {props.githubLink && (
          <a
            href={props.githubLink}
            class={`${props.githubClass} ${props.hoverClass}`}
            title="Github"
          >
            <Icon name="github" />
          </a>
        )}
      </div>
    ));

  return (
    <div
      class={`rounded-xl overflow-hidden transition-all duration-300 ${
        theme.cardBg
      } shadow-lg hover:shadow-xl transform hover:-translate-y-1`}
      data-project-id={id}
      data-model-id={modelId}
    >
      {/* Header with ModelViewer */}
      <div
        class="relative h-48 overflow-hidden"
        ref={modelContainerRef}
        style={{ "pointer-events": "auto" }}
      >
        {/* Model Viewer - Always rendered but with visibility controlled */}
        <div
          class="absolute inset-0"
          style={{ "pointer-events": "auto" }}
          data-model-container="true"
        >
          <ModelViewer
            modelId={modelId}
            modelUrl={modelUrl}
            width="100%"
            height="100%"
            autoRotate={true}
            controlsEnabled={true}
            visible={modelVisible()}
            onLoaded={handleModelLoaded}
            onError={handleModelError}
          />
        </div>

        {/* Fallback image if model isn't loaded */}
        {(!isModelLoaded() || !modelVisible()) && imageUrl && (
          <div
            class="absolute inset-0 bg-cover bg-center"
            style={{
              "background-image": `url(${imageUrl})`,
              "pointer-events": "none",
            }}
          ></div>
        )}

        {/* Gradient overlay */}
        <div
          class={`absolute inset-0 ${theme.gradient}`}
          style={{ "pointer-events": "none" }}
        ></div>

        {/* Header text content */}
        <div
          class="absolute bottom-0 left-0 p-4 w-full"
          style={{ "pointer-events": "none" }}
        >
          <div class="flex justify-between items-end">
            <div>
              <h3 class="text-white font-bold text-lg">{title}</h3>
              <div class="flex items-center gap-2">
                {company && (
                  <span class="text-white/80 text-sm">{company}</span>
                )}
                {company && period && (
                  <span class="text-white/60 text-xs">•</span>
                )}
                {period && <span class="text-white/80 text-sm">{period}</span>}
              </div>
            </div>
            {category && (
              <span
                class={`px-2 py-1 rounded-full text-xs font-medium ${theme.techBadge}`}
                style={{ "pointer-events": "auto" }}
              >
                {getCategoryLabel ? getCategoryLabel(category) : category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div class="p-5">
        <h4 class={`font-medium mb-3 ${theme.subheadingText}`}>
          {props.projectTitle || title}
        </h4>

        <p class={`text-sm mb-4 ${theme.bodyText}`}>{description}</p>

        {/* Technology badges */}
        <Show when={technologies.length > 0}>
          <div class="flex flex-wrap gap-2 mb-4">
            <For each={technologies.slice(0, 3)}>
              {(tech) => <TechBadge tech={tech} classes={theme.techBadge} />}
            </For>
            <Show when={technologies.length > 3}>
              <span
                class={`px-3 py-1 rounded-full text-xs font-medium ${theme.moreBadge}`}
              >
                +{technologies.length - 3} more
              </span>
            </Show>
          </div>
        </Show>

        {/* Action buttons and links */}
        <div class="flex items-center justify-between pt-2">
          <Show when={responsibilities.length > 0}>
            <button
              onClick={() => toggleProject(id)}
              class={`text-sm font-medium ${theme.detailsBtn} flex items-center gap-1`}
            >
              {expandedProject() === id ? "Hide details" : "View details"}
              {/* <Icon
                name="chevron-down"
                class={`ml-1 transition-transform ${
                  expandedProject() === id ? "scale-y-[-1]" : ""
                }`}
              /> */}
            </button>
          </Show>

          <SocialLinks
            videoLink={videoLink}
            storeLink={storeLink}
            githubLink={githubLink}
            videoClass={theme.videoClass}
            storeClass={theme.storeClass}
            githubClass={theme.githubClass}
            hoverClass={theme.linkHover}
          />
        </div>

        {/* Expanded details section */}
        <Show when={expandedProject() === id}>
          <div class={`mt-4 pt-4 border-t ${theme.divider}`}>
            <Show when={responsibilities.length > 0}>
              <h5 class={`text-sm font-medium mb-2 ${theme.subheadingText}`}>
                Key Contributions:
              </h5>
              <ul class={`list-disc pl-5 mb-4 text-sm ${theme.bodyText}`}>
                <For each={responsibilities}>
                  {(item) => <li class="mb-1">{item}</li>}
                </For>
              </ul>
            </Show>

            <Show when={technologies.length > 0}>
              <h5 class={`text-sm font-medium mb-2 ${theme.subheadingText}`}>
                All Technologies:
              </h5>
              <div class="flex flex-wrap gap-2">
                <For each={technologies}>
                  {(tech) => (
                    <TechBadge tech={tech} classes={theme.techBadge} />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ProjectCard;
