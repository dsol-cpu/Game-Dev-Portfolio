import { createEffect } from "solid-js";
import { Icon } from "../icons/Icon";

const LoadingScreen = (props) => {
  // Use a derived signal function instead of creating a separate signal
  const progress = () => props.progress ?? 0;

  return (
    <div class="absolute inset-0 flex items-center justify-center bg-blue-900 bg-opacity-80 z-10">
      <div class="text-center">
        <div class="relative inline-block w-24 h-24">
          <Icon
            name="wheel"
            class="w-full h-full text-yellow-300 animate-spin"
          />
        </div>
        <p class="mt-4 text-xl text-yellow-300 font-bold">
          {props.message || "Preparing your journey..."}
        </p>
        <div class="mt-3 h-2 w-48 mx-auto bg-blue-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-yellow-400 transition-all duration-300 ease-out"
            style={`width: ${progress()}%`}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
