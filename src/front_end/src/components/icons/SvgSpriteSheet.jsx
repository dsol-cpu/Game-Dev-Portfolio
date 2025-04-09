import { onMount, createEffect, onCleanup } from "solid-js";
import { createThemeManager } from "../../stores/theme";

// Import all SVGs using Vite's built-in import.meta.glob
const svgImports = import.meta.glob("/src/assets/icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

export const SvgSprite = () => {
  const themeManager = createThemeManager();
  const { isDark } = themeManager;

  // Process SVGs and create sprite
  const createSvgSprite = () => {
    const isDarkMode = isDark(); // Get current theme state
    const currentTheme = isDarkMode ? "dark" : "light";
    console.log(`Creating SVG sprite manager for theme: ${currentTheme}`);

    // Create sprite container if it doesn't exist
    let spriteContainer = document.getElementById("svg-sprite-container");
    if (!spriteContainer) {
      spriteContainer = document.createElement("div");
      spriteContainer.id = "svg-sprite-container";
      spriteContainer.style.display = "none";
      document.body.appendChild(spriteContainer);
    } else {
      // Clear existing content
      spriteContainer.innerHTML = "";
    }

    // Create SVG element to hold all symbols
    const svgElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    svgElement.setAttribute("id", "svg-sprite");
    svgElement.setAttribute("aria-hidden", "true");
    svgElement.setAttribute(
      "style",
      "position: absolute; width: 0; height: 0; overflow: hidden;"
    );

    // Add data attribute to track current theme
    svgElement.setAttribute("data-theme", currentTheme);

    // Counter for successful icons
    let successCount = 0;

    // Process each imported SVG file
    Object.entries(svgImports).forEach(([path, svgContent]) => {
      try {
        // Extract icon name from path
        const iconName = path.split("/").pop().replace(".svg", "");

        // Check if we should use the dark or light variant based on theme
        const baseIconName = iconName.replace(/-light$|-dark$/, "");

        // If this is a base icon (no -light or -dark suffix) and there are themed variants available
        const hasLightVariant = Object.keys(svgImports).some((p) =>
          p.includes(`${baseIconName}-light.svg`)
        );
        const hasDarkVariant = Object.keys(svgImports).some((p) =>
          p.includes(`${baseIconName}-dark.svg`)
        );

        // If this icon has themed variants, skip the base version to avoid duplicates
        if (iconName === baseIconName && (hasLightVariant || hasDarkVariant)) {
          // Skip base icons if themed variants exist
          return;
        }

        // If this is a themed icon, check if it matches the current theme
        if (iconName.endsWith("-light") && isDarkMode) {
          // Skip light-themed icons in dark mode if there's a dark variant
          if (hasDarkVariant) return;
        }
        if (iconName.endsWith("-dark") && !isDarkMode) {
          // Skip dark-themed icons in light mode if there's a light variant
          if (hasLightVariant) return;
        }

        // Make sure we have string content
        const content =
          typeof svgContent === "string" ? svgContent : String(svgContent);

        // Parse the SVG content
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(content, "image/svg+xml");

        // Check for parsing errors
        const parserError = svgDoc.querySelector("parsererror");
        if (parserError) {
          console.error(`Error parsing SVG for ${iconName}:`, parserError);
          return;
        }

        // Get the SVG element
        const originalSvg = svgDoc.querySelector("svg");
        if (!originalSvg) {
          console.error(`No SVG element found in ${iconName}`);
          return;
        }

        // Create symbol element
        const symbol = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "symbol"
        );

        // For themed variants, use the base name for the ID to make references consistent
        const symbolId =
          iconName.endsWith("-light") || iconName.endsWith("-dark")
            ? `icon-${baseIconName}`
            : `icon-${iconName}`;

        symbol.id = symbolId;

        // Copy viewBox
        const viewBox = originalSvg.getAttribute("viewBox");
        if (viewBox) {
          symbol.setAttribute("viewBox", viewBox);
        } else {
          // If no viewBox, create one from width and height
          const width = originalSvg.getAttribute("width") || "24";
          const height = originalSvg.getAttribute("height") || "24";
          symbol.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }

        // Add metadata attributes
        symbol.setAttribute("data-icon-name", baseIconName);
        symbol.setAttribute("data-theme-variant", currentTheme);

        // Add classes for styling
        const isSunOrMoon = baseIconName === "sun" || baseIconName === "moon";
        const themeClass = isSunOrMoon ? `theme-icon-${baseIconName}` : "";
        symbol.setAttribute("class", `themed-icon ${themeClass}`);

        // Process the SVG elements
        const childNodes = Array.from(originalSvg.childNodes);
        childNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            // Clone the node to avoid modifying the original
            const clone = node.cloneNode(true);

            // Get the stroke and fill attributes (if they exist)
            const hasStroke =
              clone.hasAttribute("stroke") &&
              clone.getAttribute("stroke") !== "none";
            const hasFill = clone.hasAttribute("fill");
            const explicitNoneFill =
              hasFill && clone.getAttribute("fill") === "none";

            // IMPROVED COLOR HANDLING:
            // 1. Always handle strokes consistently
            if (hasStroke) {
              clone.setAttribute("stroke", "currentColor");
            } else if (
              !clone.hasAttribute("stroke") &&
              (clone.tagName === "path" ||
                clone.tagName === "circle" ||
                clone.tagName === "rect" ||
                clone.tagName === "polygon")
            ) {
              // For common SVG elements, ensure stroke is explicitly set to none if not present
              clone.setAttribute("stroke", "none");
            }

            // 2. Handle fills consistently
            if (hasFill && !explicitNoneFill) {
              // If fill was explicitly set to something other than "none"
              clone.setAttribute("fill", "currentColor");
            } else if (
              !hasFill &&
              (clone.tagName === "path" ||
                clone.tagName === "circle" ||
                clone.tagName === "rect" ||
                clone.tagName === "polygon")
            ) {
              // If no fill was specified for shape elements, add currentColor
              // This ensures consistent behavior for icons that rely on default fills
              clone.setAttribute("fill", "currentColor");
            } else if (explicitNoneFill) {
              // Preserve explicit "none" fills
              clone.setAttribute("fill", "none");
            }

            symbol.appendChild(clone);
          } else {
            // For non-element nodes (like text nodes), just clone and append
            symbol.appendChild(node.cloneNode(true));
          }
        });

        // Add the symbol to the main SVG
        svgElement.appendChild(symbol);
        successCount++;
      } catch (err) {
        console.error(`Error processing SVG for ${path}:`, err);
      }
    });

    // Add to DOM
    spriteContainer.appendChild(svgElement);
    console.log(
      `SVG spritesheet created with ${successCount} icons for theme: ${currentTheme}`
    );
  };

  // Handle theme change events
  const handleThemeChange = (event) => {
    console.log(`Theme change event received:`, event.detail);
    createSvgSprite();
  };

  onMount(() => {
    // Initial creation
    createSvgSprite();

    // Add event listener for theme changes
    document.addEventListener("themeChange", handleThemeChange);
  });

  onCleanup(() => {
    // Remove event listener when component is unmounted
    document.removeEventListener("themeChange", handleThemeChange);
  });

  // Recreate sprite when theme changes using reactivity
  createEffect(() => {
    // Explicitly track the isDark signal to create dependency
    const isDarkMode = isDark();
    console.log(`Theme reactivity triggered: isDark = ${isDarkMode}`);
    createSvgSprite();
  });

  return null;
};

export default SvgSprite;
