/**
 * SVG Sprite Manager
 * File: src/js/svg-sprite-manager.js
 *
 * This class manages SVG sprites for efficient icon usage across the portfolio website.
 * It handles theme variants and provides methods for toggling between light and dark themes.
 * Includes full caching mechanism to prevent icon flashing during theme changes.
 */

class SvgSpriteManager {
  constructor(options = {}) {
    this.options = {
      isDarkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
      svgData: {},
      ...options,
    };

    // Symbol cache - stores parsed symbols for each theme
    this.symbolCache = {
      light: new Map(),
      dark: new Map(),
    };

    this.spriteCache = {
      light: null,
      dark: null,
    };

    this.init();
  }

  init() {
    // Create sprite container if it doesn't exist
    let spriteContainer = document.getElementById("svg-sprite-container");
    if (!spriteContainer) {
      spriteContainer = document.createElement("div");
      spriteContainer.id = "svg-sprite-container";
      spriteContainer.style.display = "none";
      document.body.appendChild(spriteContainer);
    }

    // Initialize the sprites for both themes
    this.parseAndCacheSvgs(this.options.svgData);
    this.createBothThemeSprites();

    // Set the initial theme
    this.switchToTheme(this.options.isDarkMode ? "dark" : "light");

    // Set up theme change listener (using system preference)
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", (e) => {
      this.options.isDarkMode = e.matches;
      this.switchToTheme(e.matches ? "dark" : "light");

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
        this.switchToTheme(event.detail.isDark ? "dark" : "light");
      }
    });
  }

  // Switch to specified theme by showing the appropriate sprite
  switchToTheme(themeName) {
    const isDark = themeName ? "dark" : "light";
    const theme = typeof themeName === "boolean" ? isDark : themeName;

    // Check if we have both sprites created
    if (!this.spriteCache.light || !this.spriteCache.dark) {
      this.createBothThemeSprites();
    }

    // Hide all sprites first
    if (this.spriteCache.light) this.spriteCache.light.style.display = "none";
    if (this.spriteCache.dark) this.spriteCache.dark.style.display = "none";

    // Show the selected theme's sprite
    if (this.spriteCache[theme]) {
      this.spriteCache[theme].style.display = "block";
      console.log(
        `Switched to ${theme} theme sprite (${this.symbolCache[theme].size} icons)`
      );
    }
  }

  addSvgs(svgData) {
    const newSvgCount = Object.keys(svgData).length;
    if (newSvgCount === 0) return;

    // Add to the existing data
    this.options.svgData = { ...this.options.svgData, ...svgData };

    // Parse and cache the new SVGs
    this.parseAndCacheSvgs(svgData);

    // Recreate the sprites after adding new SVGs
    this.createBothThemeSprites();

    // Switch to the current theme
    this.switchToTheme(this.options.isDarkMode ? "dark" : "light");

    console.log(`Added ${newSvgCount} new SVGs to cache`);
  }

  // Parse and cache SVG symbols for both themes
  parseAndCacheSvgs(svgData) {
    Object.entries(svgData).forEach(([path, svgContent]) => {
      try {
        // Extract icon name from path
        const iconName = path.split("/").pop().replace(".svg", "");

        // Check if we should use the dark or light variant based on icon name
        const isLightVariant = iconName.endsWith("-light");
        const isDarkVariant = iconName.endsWith("-dark");
        const baseIconName = iconName.replace(/-light$|-dark$/, "");

        // Check if themed variants exist for this icon
        const hasLightVariant = Object.keys(this.options.svgData).some((p) =>
          p.includes(`${baseIconName}-light.svg`)
        );
        const hasDarkVariant = Object.keys(this.options.svgData).some((p) =>
          p.includes(`${baseIconName}-dark.svg`)
        );

        // For light theme: use light variant if available, else use base icon if no dark variant exists
        if (
          isLightVariant ||
          (!isDarkVariant && !isLightVariant && !hasDarkVariant)
        ) {
          this.parseSvgToCache(svgContent, baseIconName, "light");
        }

        // For dark theme: use dark variant if available, else use base icon if no light variant exists
        if (
          isDarkVariant ||
          (!isDarkVariant && !isLightVariant && !hasLightVariant)
        ) {
          this.parseSvgToCache(svgContent, baseIconName, "dark");
        }
      } catch (err) {
        console.error(`Error caching SVG for ${path}:`, err);
      }
    });
  }

  // Parse individual SVG into a symbol and store in the cache
  parseSvgToCache(svgContent, baseIconName, theme) {
    try {
      // Make sure we have string content
      const content =
        typeof svgContent === "string" ? svgContent : String(svgContent);

      // Parse the SVG content
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(content, "image/svg+xml");

      // Check for parsing errors
      const parserError = svgDoc.querySelector("parsererror");
      if (parserError) {
        console.error(`Error parsing SVG for ${baseIconName}:`, parserError);
        return;
      }

      // Get the SVG element
      const originalSvg = svgDoc.querySelector("svg");
      if (!originalSvg) {
        console.error(`No SVG element found in ${baseIconName}`);
        return;
      }

      // Create symbol element
      const symbol = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "symbol"
      );

      const symbolId = `icon-${baseIconName}`;
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
      symbol.setAttribute("data-theme-variant", theme);

      // Add classes for styling
      const isSunOrMoon = baseIconName === "sun" || baseIconName === "moon";
      const themeClass = isSunOrMoon ? `theme-icon-${baseIconName}` : "";
      symbol.setAttribute("class", `themed-icon ${themeClass}`);

      // Process the SVG elements
      this.processNodeAndAppendToSymbol(originalSvg, symbol);

      // Store in cache
      this.symbolCache[theme].set(symbolId, symbol.cloneNode(true));
    } catch (err) {
      console.error(`Error processing SVG for ${baseIconName}:`, err);
    }
  }

  // Process SVG nodes and handle color attributes
  processNodeAndAppendToSymbol(originalNode, targetSymbol) {
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
      const strokeValue = hasStrokeAttr ? node.getAttribute("stroke") : null;
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

      // Handle fill attribute
      if (hasFillAttr) {
        // Preserve the original fill value if it's "none"
        if (fillValue === "none") {
          clone.setAttribute("fill", "none");
        } else {
          clone.setAttribute("fill", "currentColor");
        }
      } else if (!hasFillAttr) {
        // For elements without fill, make fill none
        clone.setAttribute("fill", "none");
      }

      // Process child nodes recursively
      Array.from(node.childNodes).forEach((child) => {
        clone.appendChild(processNode(child));
      });

      return clone;
    };

    // Process the root SVG children
    Array.from(originalNode.childNodes).forEach((node) => {
      targetSymbol.appendChild(processNode(node));
    });
  }

  // Create both theme sprites at once
  createBothThemeSprites() {
    // Get the container
    let spriteContainer = document.getElementById("svg-sprite-container");
    if (!spriteContainer) {
      spriteContainer = document.createElement("div");
      spriteContainer.id = "svg-sprite-container";
      spriteContainer.style.display = "none";
      document.body.appendChild(spriteContainer);
    }

    // Create sprites for both themes
    ["light", "dark"].forEach((theme) => {
      // Skip if already created and no new icons added
      if (this.spriteCache[theme]) {
        this.spriteCache[theme].remove();
      }

      // Create SVG element for this theme
      const svgElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      const spriteId = `svg-sprite-${theme}`;
      svgElement.setAttribute("id", spriteId);
      svgElement.setAttribute("aria-hidden", "true");
      svgElement.setAttribute(
        "style",
        "position: absolute; width: 0; height: 0; overflow: hidden; display: none;"
      );
      svgElement.setAttribute("data-theme", theme);

      // Add cached symbols to the sprite
      this.symbolCache[theme].forEach((symbol) => {
        svgElement.appendChild(symbol.cloneNode(true));
      });

      // Add to DOM and cache
      spriteContainer.appendChild(svgElement);
      this.spriteCache[theme] = svgElement;

      console.log(
        `Created ${theme} theme sprite with ${this.symbolCache[theme].size} icons`
      );
    });
  }

  // Manual theme toggle method
  toggleTheme() {
    // Set a flag to prevent duplicate processing
    this._isInternalToggle = true;

    this.options.isDarkMode = !this.options.isDarkMode;
    this.switchToTheme(this.options.isDarkMode ? "dark" : "light");

    // Dispatch a custom event with a source identifier
    document.dispatchEvent(
      new CustomEvent("themeChange", {
        detail: {
          isDark: this.options.isDarkMode,
          source: "svgSpriteManager", // Add source identifier
        },
      })
    );

    // Clear the flag
    setTimeout(() => {
      this._isInternalToggle = false;
    }, 0);

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
      this.switchToTheme(isDark ? "dark" : "light");

      // Dispatch a custom event
      document.addEventListener("themeChange", (event) => {
        // Skip if this event was triggered by our own toggle method
        if (this._isInternalToggle) return;

        if (typeof event.detail?.isDark === "boolean") {
          this.options.isDarkMode = event.detail.isDark;
          this.switchToTheme(event.detail.isDark ? "dark" : "light");
        }
      });
    }
    return this.options.isDarkMode;
  }
}

// Export for usage
window.SvgSpriteManager = SvgSpriteManager;
