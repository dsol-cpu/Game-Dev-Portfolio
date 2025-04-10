import { mergeProps } from "solid-js";

const SceneContainer = (props) => {
  const merged = mergeProps(
    {
      resolution: { width: 0, height: 0 },
      initialized: false,
      visible: true,
    },
    props
  );

  return (
    <div
      ref={props.ref}
      class="w-full h-full absolute inset-0"
      data-width={merged.resolution.width}
      data-height={merged.resolution.height}
      data-initialized={merged.initialized ? "true" : "false"}
      data-visible={merged.visible ? "true" : "false"}
    />
  );
};

export default SceneContainer;
