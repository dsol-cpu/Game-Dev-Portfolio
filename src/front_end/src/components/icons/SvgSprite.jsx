import { onMount } from "solid-js";

// Import all SVGs using Vite's built-in import.meta.glob
const svgImports = import.meta.glob("/src/assets/icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

export const SvgSprite = () => {
  onMount(() => {
    // Only inject once
    if (!document.getElementById("svg-sprite-container")) {
      // Create sprite container
      const spriteContainer = document.createElement("div");
      spriteContainer.id = "svg-sprite-container";
      spriteContainer.style.display = "none";

      // Create SVG element to hold all symbols
      const svgElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      svgElement.setAttribute("aria-hidden", "true");

      // Process each imported SVG file
      Object.entries(svgImports).forEach(([path, importedContent]) => {
        try {
          // Extract icon name from path
          const iconName = path.split("/").pop().replace(".svg", "");

          // Make sure we have string content
          const svgContent =
            typeof importedContent === "string"
              ? importedContent
              : importedContent.default || "";

          // Create symbol element
          const symbolElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "symbol"
          );
          symbolElement.id = `icon-${iconName}`;

          // Extract viewBox and content
          const viewBoxMatch = svgContent.match
            ? svgContent.match(/viewBox="([^"]+)"/)
            : null;
          if (viewBoxMatch && viewBoxMatch[1]) {
            symbolElement.setAttribute("viewBox", viewBoxMatch[1]);
          }

          // Clean SVG content - remove outer <svg> tags but REPLACE fill/stroke with currentColor
          let cleanedContent = svgContent
            .replace(/<svg[^>]*>/i, "")
            .replace(/<\/svg>/i, "")
            .replace(/fill="[^"]*"/g, 'fill="currentColor"')
            .replace(/stroke="[^"]*"/g, 'stroke="currentColor"');

          // Set the cleaned content
          symbolElement.innerHTML = cleanedContent;

          // Add to main SVG
          svgElement.appendChild(symbolElement);
        } catch (err) {
          console.error(`Error processing SVG: ${path}`, err);
        }
      });

      // Add to DOM
      spriteContainer.appendChild(svgElement);
      document.body.appendChild(spriteContainer);
    }
  });

  return null;
};
