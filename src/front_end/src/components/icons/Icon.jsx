import { mergeProps, splitProps } from "solid-js";

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

  // Build class name with variant
  const className = `icon icon-${local.variant} ${local.class}`.trim();

  return (
    <svg
      width={local.size}
      height={local.size}
      class={className}
      aria-hidden="true"
      {...others}
    >
      <use href={`#icon-${local.name}`} />
    </svg>
  );
};
