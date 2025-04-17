/**
 * SVG Sprite Manager
 * File: src/js/svg-sprite-manager.js
 *
 * This class manages SVG sprites for efficient icon usage across the portfolio website.
 * It handles theme variants and provides methods for toggling between light and dark themes.
 */

class SvgSpriteManager {
  constructor(options = {}) {
    this.options = {
      isDarkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
      svgData: {},
      ...options,
    };

    this.init();
  }

  init() {
    // Create initial sprite
    this.createSvgSprite();

    // Set up theme change listener (using system preference)
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", (e) => {
      this.options.isDarkMode = e.matches;
      this.createSvgSprite();

      // Dispatch a custom event for other components
      document.dispatchEvent(
        new CustomEvent("themeChange", {
          detail: { isDark: e.matches },
        })
      );
    });

    // Also listen for custom theme changes
    document.addEventListener("themeChange", (event) => {
      if (typeof event.detail?.isDark === "boolean") {
        this.options.isDarkMode = event.detail.isDark;
        this.createSvgSprite();
      }
    });
  }

  // Add SVGs programmatically (replacement for Vite's import.meta.glob)
  addSvgs(svgData) {
    this.options.svgData = { ...this.options.svgData, ...svgData };
    this.createSvgSprite();
  }

  createSvgSprite() {
    const isDarkMode = this.options.isDarkMode;
    const currentTheme = isDarkMode ? "dark" : "light";

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

    // Process each SVG
    Object.entries(this.options.svgData).forEach(([path, svgContent]) => {
      try {
        // Extract icon name from path
        const iconName = path.split("/").pop().replace(".svg", "");

        // Check if we should use the dark or light variant based on theme
        const baseIconName = iconName.replace(/-light$|-dark$/, "");

        // If this is a base icon (no -light or -dark suffix) and there are themed variants available
        const hasLightVariant = Object.keys(this.options.svgData).some((p) =>
          p.includes(`${baseIconName}-light.svg`)
        );
        const hasDarkVariant = Object.keys(this.options.svgData).some((p) =>
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

        // Process the SVG elements - FIXED COLOR HANDLING
        const processNode = (node) => {
          if (node.nodeType !== 1) {
            // For non-element nodes, just clone and append
            return node.cloneNode(true);
          }

          // Clone the node
          const clone = node.cloneNode(false); // Don't clone children yet

          // Check attributes
          const hasStrokeAttr = node.hasAttribute("stroke");
          const hasFillAttr = node.hasAttribute("fill");
          const strokeValue = hasStrokeAttr
            ? node.getAttribute("stroke")
            : null;
          const fillValue = hasFillAttr ? node.getAttribute("fill") : null;

          // Handle stroke attribute
          if (hasStrokeAttr && strokeValue !== "none") {
            clone.setAttribute("stroke", "currentColor");
          } else if (hasStrokeAttr && strokeValue === "none") {
            clone.setAttribute("stroke", "none");
          } else if (
            !hasStrokeAttr &&
            (node.tagName === "path" ||
              node.tagName === "circle" ||
              node.tagName === "rect" ||
              node.tagName === "polygon" ||
              node.tagName === "line" ||
              node.tagName === "polyline")
          ) {
            // For shape elements without stroke, set it to none explicitly
            clone.setAttribute("stroke", "none");
          }

          const fill_str = "fill";

          // Handle fill attribute
          if (hasFillAttr) {
            // Preserve the original fill value if it's "none"
            if (fillValue === "none") {
              clone.setAttribute(fill_str, "none");
            } else {
              clone.setAttribute(fill_str, "currentColor");
            }
          } else if (!hasFillAttr) {
            // For elements without fill, add make fill none
            clone.setAttribute(fill_str, "none");
          }

          // Process child nodes recursively
          Array.from(node.childNodes).forEach((child) => {
            clone.appendChild(processNode(child));
          });

          return clone;
        };

        // Process the root SVG children
        Array.from(originalSvg.childNodes).forEach((node) => {
          symbol.appendChild(processNode(node));
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
  }

  // Manual theme toggle method
  toggleTheme() {
    this.options.isDarkMode = !this.options.isDarkMode;
    this.createSvgSprite();

    // Dispatch a custom event
    document.dispatchEvent(
      new CustomEvent("themeChange", {
        detail: { isDark: this.options.isDarkMode },
      })
    );

    return this.options.isDarkMode;
  }

  // Get current theme
  isDark() {
    return this.options.isDarkMode;
  }

  // Set theme directly
  setTheme(isDark) {
    if (typeof isDark === "boolean" && isDark !== this.options.isDarkMode) {
      this.options.isDarkMode = isDark;
      this.createSvgSprite();

      // Dispatch a custom event
      document.dispatchEvent(
        new CustomEvent("themeChange", {
          detail: { isDark: this.options.isDarkMode },
        })
      );
    }
    return this.options.isDarkMode;
  }
}

// Export for usage
window.SvgSpriteManager = SvgSpriteManager;
