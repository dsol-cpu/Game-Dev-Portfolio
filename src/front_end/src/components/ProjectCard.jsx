import {
  Show,
  createMemo,
  createSignal,
  For,
  onMount,
  onCleanup,
} from "solid-js";
import { createThemeManager } from "../stores/theme";
import Icon from "./icons/Icon";
import { getModelForProject } from "../stores/projectModelMapping";
import Model from "./Model";

const ProjectCard = (props) => {
  let cardRef;
  const { isDark } = createThemeManager();
  const [isVisible, setIsVisible] = createSignal(false);
  const [modelLoaded, setModelLoaded] = createSignal(false);
  const [modelError, setModelError] = createSignal(false);
  const [noModelFound, setNoModelFound] = createSignal(false);
  const [useFallback, setUseFallback] = createSignal(false);

  // Memoize model configuration
  const modelConfig = createMemo(() => {
    if (!props.project) {
      setNoModelFound(true);
      return { name: "cube", shape: "cube" };
    }

    // Get model based on project
    const projectModel = getModelForProject(props.project);

    if (!projectModel || (!projectModel.name && !projectModel.shape)) {
      console.warn(
        `No model found for project: ${props.project?.title || "Unknown"}`
      );
      setNoModelFound(true);
      return { shape: "cube", fallbackShape: "cube" };
    }

    // Handle both primitive shapes and custom model paths
    return {
      name: projectModel.name || `project-${props.project?.id || "unknown"}`,
      shape: projectModel.shape || "cube",
      path: projectModel.path, // Support for custom model path
      fallbackShape: projectModel.fallbackShape || "cube",
      isCustom: !!projectModel.path, // Flag for custom model
    };
  });

  // Configure the final model props based on state
  const activeModelProps = createMemo(() => {
    const config = modelConfig();

    // Use fallback if there was an error or specifically requested
    if (modelError() || useFallback() || noModelFound()) {
      return {
        name: `fallback-${props.project?.id || Date.now()}`,
        shape: config.fallbackShape,
        forcePrimitive: true,
      };
    }

    // For custom model paths
    if (config.isCustom) {
      return {
        name: config.name,
        shape: config.shape,
        customPath: config.path,
        forcePrimitive: false,
        fallbackShape: config.fallbackShape,
      };
    }

    // Standard primitive shapes
    return {
      name: config.name,
      shape: config.shape,
      forcePrimitive: false,
    };
  });

  // Memoize theme styles
  const theme = createMemo(() => {
    const dark = isDark();
    return {
      card: `rounded-lg overflow-hidden shadow-md transition-all duration-300 ${dark ? "bg-gray-800" : "bg-white"}`,
      header: `relative h-52 overflow-hidden`,
      loadingPlaceholder: `animate-pulse ${dark ? "bg-gray-700" : "bg-gray-200"} h-full w-full rounded-t-lg`,
      fallbackPlaceholder: `flex items-center justify-center ${dark ? "bg-gray-700" : "bg-gray-200"} h-full w-full rounded-t-lg`,
    };
  });

  // Handle model load complete
  const handleModelLoaded = () => {
    setModelLoaded(true);
  };

  // Handle model error - switch to fallback
  const handleModelError = (error) => {
    console.error("Model failed to load for:", props.project?.title, error);
    setModelError(true);
    setUseFallback(true);
  };

  // Fallback content component
  const FallbackContent = () => (
    <div class={theme().fallbackPlaceholder}>
      <div class="text-center">
        <div class="text-sm font-medium">Project Preview</div>
        <div class="text-xs opacity-70">
          {props.project?.title || "No Title"}
        </div>
      </div>
    </div>
  );

  // Setup intersection observer for lazy loading
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "200px",
        threshold: 0.01,
      }
    );

    if (cardRef) {
      observer.observe(cardRef);
    }

    onCleanup(() => {
      if (cardRef) observer.unobserve(cardRef);
    });
  });

  // Control when to render the 3D model
  const shouldRenderModel = createMemo(
    () => isVisible() && (props.forceRender || true)
  );

  // Memoize background color
  const bgColor = createMemo(() => (isDark() ? 0x1e1e2e : 0xf8f9fa));

  return (
    <div
      ref={cardRef}
      class={theme().card}
      onClick={() => props.onToggleDetails?.()}
      data-project-id={props.project?.id}
    >
      {/* 3D Model Header */}
      <div class={theme().header}>
        <Show
          when={shouldRenderModel()}
          fallback={<div class={theme().loadingPlaceholder} />}
        >
          <Model
            name={activeModelProps().name}
            shape={activeModelProps().shape}
            customPath={activeModelProps().customPath}
            backgroundColor={bgColor()}
            size="100%"
            rotate={true}
            forcePrimitive={activeModelProps().forcePrimitive}
            fallbackShape={activeModelProps().fallbackShape}
            onLoaded={handleModelLoaded}
            onError={handleModelError}
          />
        </Show>

        {/* Header content - title, badges, etc. */}
        <div class="absolute bottom-0 left-0 p-3 w-full">
          <h3 class="text-base font-bold text-white truncate">
            {props.project?.title || "Untitled Project"}
          </h3>
        </div>
      </div>

      {/* Card Content - basic description */}
      <div class="p-3">
        <p class="text-xs mb-2">
          {props.project?.shortDescription || "No description available"}
        </p>

        {/* Detail toggle button */}
        <div class="flex justify-end mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleDetails?.();
            }}
            class="text-xs font-medium flex items-center gap-1"
          >
            {props.isExpanded ? "Show Less" : "Show More"}
            <Icon
              name={props.isExpanded ? "chevron-up" : "chevron-down"}
              className="w-3.5 h-3.5"
            />
          </button>
        </div>

        {/* Expanded content - only render when expanded */}
        <Show when={props.isExpanded}>
          <div class="mt-2 pt-2 border-t">
            {/* Full description */}
            <p class="text-xs">
              {props.project?.description ||
                "No detailed description available."}
            </p>

            {/* Action buttons */}
            <div class="flex gap-2 mt-3">
              <Show when={props.project?.liveUrl}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(props.project.liveUrl, "_blank");
                  }}
                  class="py-1.5 px-3 text-xs font-medium rounded-md text-white flex items-center gap-1 bg-blue-500"
                >
                  <Icon name="external-link" className="w-3.5 h-3.5" />
                  Live Demo
                </button>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ProjectCard;
