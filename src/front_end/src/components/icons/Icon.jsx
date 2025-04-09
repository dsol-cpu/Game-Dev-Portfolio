import {
  mergeProps,
  splitProps,
  createSignal,
  onMount,
  createEffect,
  Show,
} from "solid-js";

export const Icon = (props) => {
  const [local, others] = splitProps(
    mergeProps(
      {
        size: "24px",
        variant: "primary",
        class: "",
      },
      props
    ),
    ["name", "size", "class", "variant"]
  );

  // Create a signal to track if the icon exists in the sprite
  const [iconExists, setIconExists] = createSignal(null); // Start with null instead of false

  // Build class name with variant
  const className = `icon icon-${local.variant} ${local.class}`.trim();

  const checkIconExists = () => {
    const iconId = `icon-${local.name}`;
    const symbolExists = document.getElementById(iconId);
    setIconExists(!!symbolExists);

    if (!symbolExists) {
      console.warn(`Icon "${local.name}" not found in sprite`);
    }
  };

  onMount(() => {
    checkIconExists();

    // Also check after a small delay to ensure the sprite has been mounted
    setTimeout(checkIconExists, 50);
  });

  // Check when the name changes
  createEffect(() => {
    // Access name to create dependency
    const iconName = local.name;
    if (iconExists() !== null) {
      // Only recheck if we've done the initial check
      checkIconExists();
    }
  });

  return (
    <svg
      width={local.size}
      height={local.size}
      class={className}
      aria-hidden="true"
      {...others}
    >
      <Show
        when={iconExists() !== false}
        fallback={
          <rect
            width={local.size}
            height={local.size}
            fill="currentColor"
            opacity="0.2"
          />
        }
      >
        <use href={`#icon-${local.name}`} />
      </Show>
    </svg>
  );
};

export default Icon;
