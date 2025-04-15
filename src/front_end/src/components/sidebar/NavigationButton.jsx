// This is a template - update with your actual NavigationButton structure
import { createMemo } from "solid-js";

const NavigationButton = (props) => {
  const buttonClass = createMemo(() => {
    const baseClass =
      "flex items-center w-full p-2 rounded-md transition-all duration-200";
    const activeClass = props.isActive()
      ? "bg-blue-600 text-white font-bold"
      : "hover:bg-blue-100 text-gray-700";
    const disabledClass = props.isDisabled()
      ? "opacity-50 cursor-not-allowed"
      : "cursor-pointer";

    return `${baseClass} ${activeClass} ${disabledClass}`;
  });

  const handleClick = (e) => {
    // Always call the onClick handler, even if button appears disabled
    // The parent component will decide what to do
    console.log("Button clicked:", props.sectionName);
    props.onClick(e);
  };

  return (
    <button
      class={buttonClass()}
      onClick={handleClick}
      disabled={false} // Never actually disable the button
      data-section={props.sectionName}
    >
      {props.icon && <span class="mr-2">{props.icon}</span>}
      <span>
        {props.sectionName}
        {props.status()}
      </span>
    </button>
  );
};

export default NavigationButton;
