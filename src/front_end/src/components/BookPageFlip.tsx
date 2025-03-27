import { createSignal, onMount, onCleanup } from "solid-js";

export const BookPageFlip = () => {
  let canvasRef: HTMLCanvasElement | undefined;
  let gl: WebGL2RenderingContext | null = null;

  // Page flip state
  const [currentPage, setCurrentPage] = createSignal(0);
  const [pageFlipProgress, setPageFlipProgress] = createSignal(0);

  // Shader sources for page flip effect
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    
    uniform float u_pageFlipProgress;
    uniform vec2 u_pageSize;
    
    varying vec2 v_texCoord;
    varying float v_flipProgress;
    
    void main() {
      // Simulate page curl effect
      float angle = u_pageFlipProgress * 3.14159 * 0.5;
      mat4 rotationMatrix = mat4(
        cos(angle), -sin(angle), 0, 0,
        sin(angle), cos(angle), 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      );
      
      vec4 rotatedPosition = rotationMatrix * vec4(a_position, 0, 1);
      gl_Position = vec4(rotatedPosition.xy, 0, 1);
      
      v_texCoord = a_texCoord;
      v_flipProgress = u_pageFlipProgress;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    
    uniform sampler2D u_pageTexture;
    uniform float u_pageFlipProgress;
    
    varying vec2 v_texCoord;
    varying float v_flipProgress;
    
    void main() {
      // Add subtle shadow and lighting effect during page flip
      vec4 pageColor = texture2D(u_pageTexture, v_texCoord);
      float shadowIntensity = 1.0 - (v_flipProgress * 0.5);
      
      gl_FragColor = vec4(
        pageColor.rgb * shadowIntensity, 
        pageColor.a
      );
    }
  `;

  // Book configuration
  const bookConfig = {
    pageCount: 10,
    pageWidth: 400,
    pageHeight: 600,
  };

  // Page flip interaction
  const handlePageFlip = (direction: "next" | "previous") => {
    if (direction === "next" && currentPage() < bookConfig.pageCount - 1) {
      let progress = 0;
      const animateFlip = () => {
        progress += 0.05;
        setPageFlipProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animateFlip);
        } else {
          setCurrentPage((prev) => prev + 1);
          setPageFlipProgress(0);
        }
      };
      animateFlip();
    } else if (direction === "previous" && currentPage() > 0) {
      let progress = 0;
      const animateFlip = () => {
        progress += 0.05;
        setPageFlipProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animateFlip);
        } else {
          setCurrentPage((prev) => prev - 1);
          setPageFlipProgress(0);
        }
      };
      animateFlip();
    }
  };

  // WebGL setup and rendering
  onMount(() => {
    if (!canvasRef) return;

    // Initialize WebGL context
    gl = canvasRef.getContext("webgl2");
    if (!gl) {
      console.error("WebGL 2 not supported");
      return;
    }

    // Configure canvas
    canvasRef.width = bookConfig.pageWidth;
    canvasRef.height = bookConfig.pageHeight;

    // Shader and rendering setup would follow here...
  });

  return (
    <div class="book-page-flip-container">
      <canvas ref={canvasRef} class="page-flip-canvas" />
      <div class="page-navigation">
        <button
          onClick={() => handlePageFlip("previous")}
          disabled={currentPage() === 0}
        >
          Previous Page
        </button>
        <button
          onClick={() => handlePageFlip("next")}
          disabled={currentPage() === bookConfig.pageCount - 1}
        >
          Next Page
        </button>
      </div>
      <div class="page-indicator">
        Page {currentPage() + 1} of {bookConfig.pageCount}
      </div>
    </div>
  );
};

export default BookPageFlip;
