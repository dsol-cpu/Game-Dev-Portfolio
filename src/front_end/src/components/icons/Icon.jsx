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
    setTimeout(checkIconExists, 100); // Increased timeout for better chance of sprite being loaded
  });

  createEffect(() => {
    const iconId = `icon-${local.name}`;

    const symbolExists = document.getElementById(iconId);
    setIconExists(!!symbolExists);

    if (!symbolExists) {
      console.warn(`Icon "${local.name}" not found in sprite`);
    }
  });

  return (
    <Show
      when={iconExists()}
      fallback={
        <div
          class="icon-placeholder"
          style={{ width: local.size, height: local.size }}
          title={`Icon ${local.name} not found`}
        ></div>
      }
    >
      <svg
        class={className}
        width={local.size}
        height={local.size}
        aria-hidden="true"
        {...others}
      >
        <use href={`#icon-${local.name}`} />
      </svg>
    </Show>
  );
};

export default Icon;
