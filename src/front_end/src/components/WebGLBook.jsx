import { createSignal, createEffect, onCleanup } from "solid-js";
import { mat4 } from "gl-matrix";

const WebGLBook = () => {
  let canvasRef = null;

  createEffect(() => {
    if (!canvasRef) return;

    const gl = canvasRef.getContext("webgl");

    if (!gl) {
      alert(
        "Unable to initialize WebGL. Your browser or machine may not support it."
      );
      return;
    }

    // Clear the color buffer with specified clear color
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  });

  return (
    <canvas
      id="gl-canvas"
      ref={(el) => {
        canvasRef = el;
      }}
      width={640}
      height={480}
      style={{
        "background-color": "black",
        width: "100%",
        height: "100%",
      }}
    ></canvas>
  );
};

export default WebGLBook;
